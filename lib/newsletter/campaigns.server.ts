import 'server-only'
import { after } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getAdminDb, getAdminProjectId } from '@/lib/firebase/admin'
import { recordUsageBatch } from '@/lib/usage/recordUsage'
import { usageEnvOf } from '@/lib/usage/usageTypes'
import {
  BATCH_GAP_MS,
  BATCH_SIZE,
  buildNewsletterMessage,
  sendNewsletterBatch,
  type NewsletterContent,
} from '@/lib/email/newsletterEmail'
import { emailHash, type AudienceFilter, type NewsletterRecipient } from './audience.server'

// Campaign history (newsletterCampaigns) and the sender that works through an
// audience in batches. Both collections are Admin-SDK only (firestore.rules).

export const CAMPAIGNS_COLLECTION = 'newsletterCampaigns'
export const SENDS_COLLECTION = 'newsletter_sends'
/** A campaign still "sending" after this long is treated as dead, so it can't block the next one forever. */
export const SENDING_STALE_MS = 15 * 60 * 1000

export type CampaignStatus = 'sending' | 'sent' | 'partial' | 'failed' | 'simulated'

export interface CampaignRecord {
  id: string
  subject: string
  headline: string
  audience: AudienceFilter
  status: CampaignStatus
  recipientCount: number
  sentCount: number
  failedCount: number
  simulated: boolean
  env: string
  error: string | null
  createdAt: string | null
  completedAt: string | null
  sentBy: string
}

/**
 * Real campaigns go out only from Production with a Resend key. Anywhere else
 * (the DEV project, local, no key) a send is simulated: counted and recorded, never emailed.
 */
export function campaignSendMode(): 'live' | 'simulated' {
  return process.env.RESEND_API_KEY && usageEnvOf(getAdminProjectId()) === 'prod' ? 'live' : 'simulated'
}

const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : null)

export async function hasCampaignInFlight(now = Date.now()): Promise<boolean> {
  const snap = await getAdminDb().collection(CAMPAIGNS_COLLECTION).where('status', '==', 'sending').get()
  return snap.docs.some((doc) => {
    const created = doc.data().createdAt
    return !(created instanceof Timestamp) || now - created.toMillis() < SENDING_STALE_MS
  })
}

export async function createCampaign(params: { content: NewsletterContent; audience: AudienceFilter; recipientCount: number; mode: 'live' | 'simulated' }): Promise<string> {
  const ref = getAdminDb().collection(CAMPAIGNS_COLLECTION).doc()
  await ref.set({
    subject: params.content.subject,
    headline: params.content.headline,
    body: params.content.body,
    ctaLabel: params.content.ctaLabel || null,
    ctaUrl: params.content.ctaUrl || null,
    audience: params.audience,
    status: 'sending',
    recipientCount: params.recipientCount,
    sentCount: 0,
    failedCount: 0,
    simulated: params.mode === 'simulated',
    env: usageEnvOf(getAdminProjectId()),
    error: null,
    sentBy: 'admin',
    createdAt: FieldValue.serverTimestamp(),
    completedAt: null,
  })
  return ref.id
}

export async function listCampaigns(limit = 50): Promise<CampaignRecord[]> {
  const snap = await getAdminDb().collection(CAMPAIGNS_COLLECTION).orderBy('createdAt', 'desc').limit(limit).get()
  return snap.docs.map((doc) => {
    const d = doc.data()
    return {
      id: doc.id,
      subject: String(d.subject ?? ''),
      headline: String(d.headline ?? ''),
      audience: d.audience as AudienceFilter,
      status: d.status as CampaignStatus,
      recipientCount: Number(d.recipientCount ?? 0),
      sentCount: Number(d.sentCount ?? 0),
      failedCount: Number(d.failedCount ?? 0),
      simulated: d.simulated === true,
      env: String(d.env ?? ''),
      error: typeof d.error === 'string' ? d.error : null,
      createdAt: iso(d.createdAt),
      completedAt: iso(d.completedAt),
      sentBy: String(d.sentBy ?? 'admin'),
    }
  })
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Works through the audience, 100 emails per Resend call, then closes the campaign record. Never throws. */
export async function runCampaign(params: {
  campaignId: string
  content: NewsletterContent
  recipients: NewsletterRecipient[]
  origin: string
  mode: 'live' | 'simulated'
}): Promise<void> {
  const { campaignId, content, recipients, origin, mode } = params
  const db = getAdminDb()
  const campaign = db.collection(CAMPAIGNS_COLLECTION).doc(campaignId)
  let sent = 0
  let failed = 0
  let firstError: string | null = null

  try {
    if (mode === 'simulated') {
      sent = recipients.length
      console.info(`[newsletter] simulated campaign ${campaignId}: ${sent} emails not sent`)
      recordUsageBatch({ 'resend.simulated': sent })
    } else {
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        if (i > 0) await sleep(BATCH_GAP_MS)
        const chunk = recipients.slice(i, i + BATCH_SIZE)
        const outcome = await sendNewsletterBatch(chunk.map((r) => buildNewsletterMessage(content, r, origin)))
        sent += outcome.sent
        failed += outcome.failed
        if (outcome.error && !firstError) firstError = outcome.error
        if (outcome.sent) {
          // resend.emailsSent is counted by getResend() (lib/email/brandedEmail.ts).
          const batch = db.batch()
          for (const r of chunk) batch.set(db.collection(SENDS_COLLECTION).doc(`${campaignId}_${emailHash(r.email)}`), { campaignId, sentAt: FieldValue.serverTimestamp() })
          await batch.commit().catch((err) => console.warn('[newsletter] send log not written', err instanceof Error ? err.message : err))
        }
        await campaign.update({ sentCount: sent, failedCount: failed }).catch(() => undefined)
      }
    }
  } catch (err) {
    firstError = firstError ?? (err instanceof Error ? err.message : String(err))
    failed = recipients.length - sent
  }

  const status: CampaignStatus = mode === 'simulated' && !failed ? 'simulated' : failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial'
  await campaign
    .update({ status, sentCount: sent, failedCount: failed, error: firstError, completedAt: FieldValue.serverTimestamp() })
    .catch((err) => console.error('[newsletter] campaign record not closed', err instanceof Error ? err.message : err))
}

/** Runs `task` after the response is out; detached outside a request scope (tests). */
export function runAfterResponse(task: () => Promise<void>): void {
  try {
    after(task)
  } catch {
    void task()
  }
}
