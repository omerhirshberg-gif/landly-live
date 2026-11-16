import 'server-only'
import { SUPPORT_EMAIL } from '@/lib/config'
import { EmailProviderError, emailConfigProblem, getResend } from '@/lib/email/brandedEmail'
import { getAdminDb, getAdminProjectId } from '@/lib/firebase/admin'
import { loadUsageReport } from './loadUsageReport.server'
import { buildMonthlyCostsEmail, type ReportLang } from './monthlyCostsEmail'
import { recordUsage } from './recordUsage'
import { usageEnvOf } from './usageTypes'

// Sends the monthly Usage & Costs email (HTML + UTF-8 BOM CSV) through Resend.
// The cron sends the month that just ended, once: a Firestore lock
// (system_config/monthly_costs_report_YYYY-MM) stops a retried or duplicated
// trigger from mailing twice. The admin's manual send ignores the lock. Only
// the PROD project with a Resend key emails; anywhere else the send is
// simulated (counted, never mailed), like the newsletter.

export const LOCK_STALE_MS = 15 * 60 * 1000

export const lockPath = (month: string) => `system_config/monthly_costs_report_${month}`

/** Where the report goes: COSTS_REPORT_EMAIL, else the team inbox. */
export function reportRecipient(): string {
  return process.env.COSTS_REPORT_EMAIL?.trim() || SUPPORT_EMAIL
}

/** The UTC calendar month before `now`: on 2026-12-01 it is 2026-11. */
export function previousMonthKey(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7)
}

export type SendOutcome =
  | { status: 'sent'; month: string; to: string }
  | { status: 'simulated'; month: string; to: string }
  | { status: 'skipped'; month: string; reason: 'already-sent' | 'in-progress' }

function liveMode(): boolean {
  return !!process.env.RESEND_API_KEY && usageEnvOf(getAdminProjectId()) === 'prod'
}

type Claim = 'claimed' | 'already-sent' | 'in-progress'

async function claimLock(month: string, now: number): Promise<Claim> {
  const db = getAdminDb()
  const ref = db.doc(lockPath(month))
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const data = snap.exists ? snap.data() : undefined
    if (data?.status === 'sent') return 'already-sent' as const
    if (data?.status === 'sending' && typeof data.claimedAt === 'number' && now - data.claimedAt < LOCK_STALE_MS) return 'in-progress' as const
    tx.set(ref, { status: 'sending', claimedAt: now, projectId: getAdminProjectId() })
    return 'claimed' as const
  })
}

export async function sendMonthlyCostsReport(options: { month: string; lang?: ReportLang; guarded: boolean }): Promise<SendOutcome> {
  const { month, guarded } = options
  const to = reportRecipient()
  const live = liveMode()
  if (live) {
    const problem = emailConfigProblem()
    if (problem) throw new Error(problem)
  }

  const db = getAdminDb()
  const lock = live && guarded ? await claimLock(month, Date.now()) : 'claimed'
  if (lock !== 'claimed') return { status: 'skipped', month, reason: lock }

  try {
    const email = buildMonthlyCostsEmail(await loadUsageReport(month), options.lang ?? 'en')
    if (!live) {
      recordUsage('resend.simulated')
      return { status: 'simulated', month, to }
    }
    const { error } = await getResend().emails.send(
      {
        from: process.env.EMAIL_FROM!,
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: [{ filename: email.csvFilename, content: Buffer.from(email.csv, 'utf8') }],
      },
      guarded ? { idempotencyKey: `monthly-costs-${month}` } : undefined
    )
    if (error) throw new EmailProviderError(error.name, error.statusCode, error.message)
    if (guarded) await db.doc(lockPath(month)).set({ status: 'sent', sentAt: Date.now(), to, projectId: getAdminProjectId() })
    return { status: 'sent', month, to }
  } catch (error) {
    // Free the lock so the next trigger (Vercel retries, or a manual re-run) can try again.
    if (live && guarded) await db.doc(lockPath(month)).delete().catch(() => undefined)
    throw error
  }
}
