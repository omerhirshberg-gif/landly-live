import 'server-only'
import { SUPPORT_EMAIL } from '@/lib/config'
import { EmailProviderError, emailConfigProblem, escapeHtml, getResend } from '@/lib/email/brandedEmail'
import { getAdminProjectId } from '@/lib/firebase/admin'
import { recordUsage } from '@/lib/usage/recordUsage'
import { usageEnvOf } from '@/lib/usage/usageTypes'
import type { SyncReport } from './raayonitDailySync'

// The one email the daily Raayonit sync may send, and only when an admin has something to do: a run stopped by a safety
// guard (or failed), or new partners waiting for review. A routine "nothing changed" run never mails. Like the monthly costs
// report, only the PROD project with a Resend key really sends; everywhere else the send is counted and simulated.

export const needsAlert = (r: Pick<SyncReport, 'status' | 'dry' | 'counts'>): boolean =>
  !r.dry && (r.status === 'aborted_guard' || r.status === 'error' || r.counts.pendingReview > 0)

export function alertContent(r: SyncReport): { subject: string; text: string; html: string } {
  const lines: string[] = []
  if (r.status === 'aborted_guard' || r.status === 'error') lines.push(`The Raayonit sync did not apply anything (${r.status}): ${r.abortReason ?? 'unknown reason'}.`)
  if (r.counts.pendingReview > 0) lines.push(`${r.counts.pendingReview} new partner(s) are waiting for review in Admin > Inventory: ${r.added.filter((a) => a.kind === 'unknown').map((a) => a.nameHe).join(', ')}.`)
  const subject = r.status === 'ok' ? `Raayonit sync: ${r.counts.pendingReview} new partner(s) to review` : `Raayonit sync stopped: ${r.abortReason ?? r.status}`
  const text = [`Raayonit daily sync ${r.date}`, ...lines].join('\n\n')
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.5;color:#0f172a"><h2 style="margin:0 0 12px">Raayonit daily sync ${escapeHtml(r.date)}</h2>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}</div>`
  return { subject, text, html }
}

export type AlertOutcome = 'sent' | 'simulated' | 'none'

export async function sendSyncAlert(report: SyncReport): Promise<AlertOutcome> {
  if (!needsAlert(report)) return 'none'
  const { subject, text, html } = alertContent(report)
  if (!(process.env.RESEND_API_KEY && usageEnvOf(getAdminProjectId()) === 'prod')) {
    recordUsage('resend.simulated')
    return 'simulated'
  }
  const problem = emailConfigProblem()
  if (problem) throw new Error(problem)
  const { error } = await getResend().emails.send({ from: process.env.EMAIL_FROM!, to: process.env.COSTS_REPORT_EMAIL?.trim() || SUPPORT_EMAIL, subject, text, html }, { idempotencyKey: `raayonit-sync-${report.date}-${report.status}` })
  if (error) throw new EmailProviderError(error.name, error.statusCode, error.message)
  return 'sent'
}
