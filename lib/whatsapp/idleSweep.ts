import 'server-only'
import { FieldValue, Timestamp, type DocumentData, type DocumentReference } from 'firebase-admin/firestore'
import { maskPhone } from '@/lib/auth/phoneVerification'
import { getAdminDb } from '@/lib/firebase/admin'
import { logMessages, MESSAGE_TTL_MS, snippetOf, type LoggedMessage } from './conversationLog'
import { sendWhatsAppMessage, whatsappLive } from './graph'
import { currentStatus, CUSTOMER_SERVICE_WINDOW_MS, IDLE_GRACE_MS, idleCheckInMessage, idleMs, isConversationStatus, transcriptText } from './supportBot'
import { isBotLanguage } from './webhookPayload'

// The support bot's timed work, run every few minutes by
// /api/cron/whatsapp-idle (Vercel Cron in production; scripts/
// whatsapp-idle-sweep.mjs calls a local or Preview deployment):
//
// - check-in: a conversation the bot spoke last in, left by the member for
//   idleMs() and not with the team, gets one "Are you still looking for
//   help?" with Yes, need help / All set (idleCheckInAt, and idleResume
//   when it was waiting for the member's request). Only inside Meta's
//   24-hour window, so no template is needed.
// - resolve: a check-in unanswered for IDLE_GRACE_MS resolves the
//   conversation silently (resolvedBy: idle).
// - purge: a safety net behind the Firestore TTL policy on expiresAt (180
//   days after the latest message): conversations PURGE_SLACK_MS past it are
//   deleted with their messages, in case the policy isn't deployed.
//
// Each change is claimed in a transaction first, so overlapping runs never
// send twice. Firestore is getAdminDb()'s project, which
// lib/firebase/envGuard.ts pins: the dev project locally and on Vercel
// Preview, production on Production.

const SWEEP_LIMIT = 200
const PURGE_LIMIT = 500
export const PURGE_SLACK_MS = 3 * 24 * 60 * 60 * 1000
const PHONE_NUMBER_ID = /^\d{1,32}$/

const millis = (value: unknown) => (value instanceof Timestamp ? value.toMillis() : undefined)

export type IdleAction = 'checkIn' | 'resolve'

/** What the sweep does to a conversation now, if anything. */
export function idleAction(data: DocumentData, now: number, idle = idleMs()): IdleAction | null {
  const status = currentStatus({
    status: isConversationStatus(data.status) ? data.status : undefined,
    escalatedAt: millis(data.escalatedAt),
    inquiryPromptedAt: millis(data.inquiryPromptedAt),
    now,
  })
  // A person has it, or it's over: nothing to chase.
  if (status === 'escalated' || status === 'resolved') return null
  const lastInbound = millis(data.lastInboundAt)
  const checkedIn = millis(data.idleCheckInAt)
  if (checkedIn !== undefined) {
    const answered = lastInbound !== undefined && lastInbound >= checkedIn
    return !answered && now - checkedIn >= IDLE_GRACE_MS ? 'resolve' : null
  }
  const lastOutbound = millis(data.lastOutboundAt)
  if (lastInbound === undefined || lastOutbound === undefined) return null
  const botSpokeLast = lastOutbound > lastInbound
  const windowOpen = now - lastInbound < CUSTOMER_SERVICE_WINDOW_MS
  return botSpokeLast && windowOpen && now - lastOutbound >= idle ? 'checkIn' : null
}

export interface SweepResult {
  checkedIn: number
  resolved: number
  purged: number
}

export async function sweepIdleConversations(now = Date.now()): Promise<SweepResult> {
  const db = getAdminDb()
  const conversations = db.collection('whatsappConversations')
  const idle = idleMs()
  const result: SweepResult = { checkedIn: 0, resolved: 0, purged: 0 }

  // The bot's last word was between the window's start and idle ago.
  const quiet = await conversations
    .where('lastOutboundAt', '>', Timestamp.fromMillis(now - CUSTOMER_SERVICE_WINDOW_MS))
    .where('lastOutboundAt', '<=', Timestamp.fromMillis(now - idle))
    .orderBy('lastOutboundAt')
    .limit(SWEEP_LIMIT)
    .get()
  for (const doc of quiet.docs) {
    try {
      const claimed = await claim(doc.ref, now, idle, 'checkIn')
      if (claimed) {
        await checkIn(doc.id, claimed, now)
        result.checkedIn++
      }
    } catch (err) {
      console.error(`[whatsapp-idle] check-in for ${maskPhone(`+${doc.id}`)} failed:`, err instanceof Error ? err.message : err)
    }
  }

  const unanswered = await conversations
    .where('idleCheckInAt', '<=', Timestamp.fromMillis(now - IDLE_GRACE_MS))
    .orderBy('idleCheckInAt')
    .limit(SWEEP_LIMIT)
    .get()
  for (const doc of unanswered.docs) {
    try {
      if (await claim(doc.ref, now, idle, 'resolve')) result.resolved++
    } catch (err) {
      console.error(`[whatsapp-idle] resolving ${maskPhone(`+${doc.id}`)} failed:`, err instanceof Error ? err.message : err)
    }
  }

  const expired = await conversations.where('expiresAt', '<', Timestamp.fromMillis(now - PURGE_SLACK_MS)).limit(PURGE_LIMIT).get()
  for (const doc of expired.docs) {
    try {
      await db.recursiveDelete(doc.ref)
      result.purged++
    } catch (err) {
      console.error(`[whatsapp-idle] purging ${maskPhone(`+${doc.id}`)} failed:`, err instanceof Error ? err.message : err)
    }
  }

  console.info(`[whatsapp-idle] ${result.checkedIn} checked in, ${result.resolved} resolved, ${result.purged} purged`)
  return result
}

/** Applies `action` if it is still due, in a transaction; resolves to the conversation as it was, or null. */
async function claim(ref: DocumentReference, now: number, idle: number, action: IdleAction): Promise<DocumentData | null> {
  return getAdminDb().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    const data = snapshot.data()
    if (!data || idleAction(data, now, idle) !== action) return null
    const at = Timestamp.fromMillis(now)
    if (action === 'checkIn') {
      const awaitingInquiry = currentStatus({ status: isConversationStatus(data.status) ? data.status : undefined, inquiryPromptedAt: millis(data.inquiryPromptedAt), now }) === 'awaiting_user_inquiry'
      tx.set(ref, { idleCheckInAt: at, ...(awaitingInquiry ? { idleResume: 'inquiry' } : {}) }, { merge: true })
    } else {
      const clear = FieldValue.delete()
      // Like the member's own All set, without a sign-off: they have gone.
      tx.set(
        ref,
        {
          status: 'resolved',
          resolvedAt: at,
          resolvedBy: 'idle',
          escalatedAt: clear,
          lastMenuAt: clear,
          lastNudgeAt: clear,
          inquiryPromptedAt: clear,
          idleCheckInAt: clear,
          idleResume: clear,
        },
        { merge: true }
      )
    }
    return data
  })
}

/** Sends the check-in from the number the member last wrote to (or logs it, when not live), and adds it to the transcript. */
async function checkIn(waId: string, data: DocumentData, now: number): Promise<void> {
  const lang = isBotLanguage(data.lang) ? data.lang : 'en'
  const message = idleCheckInMessage(lang)
  const phoneNumberId = typeof data.phoneNumberId === 'string' && PHONE_NUMBER_ID.test(data.phoneNumberId) ? data.phoneNumberId : undefined
  const entry: LoggedMessage = { direction: 'out', author: 'bot', kind: 'interactive', text: transcriptText(message), at: now }
  const to = maskPhone(`+${waId}`)
  if (!whatsappLive(phoneNumberId)) {
    console.info(`[whatsapp-idle] simulated check-in to ${to}: ${JSON.stringify(message)}`)
    entry.simulated = true
  } else {
    try {
      entry.id = await sendWhatsAppMessage(waId, message, phoneNumberId)
    } catch (err) {
      // The claim stands: the conversation is resolved after the grace period rather than retried.
      entry.error = err instanceof Error ? err.message : String(err)
      console.error(`[whatsapp-idle] check-in to ${to} not sent:`, entry.error)
    }
  }
  await logMessages(waId, [entry])
  if (entry.error) return
  await getAdminDb()
    .collection('whatsappConversations')
    .doc(waId)
    .set(
      { lastOutboundAt: Timestamp.fromMillis(now), lastSnippet: snippetOf(entry), expiresAt: Timestamp.fromMillis(now + MESSAGE_TTL_MS) },
      { merge: true }
    )
}
