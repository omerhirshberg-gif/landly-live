import 'server-only'
import { FieldValue, Timestamp, type DocumentData, type DocumentReference } from 'firebase-admin/firestore'
import { maskPhone } from '@/lib/auth/phoneVerification'
import { getAdminDb } from '@/lib/firebase/admin'
import { recordUsage } from '@/lib/usage/recordUsage'
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
//   conversation without a word to the member (resolvedBy: idle), and
//   leaves the team a note in the transcript (AUTO_RESOLVED_NOTE).
// - purge: a safety net behind the Firestore TTL policy on expiresAt (180
//   days after the latest message): conversations PURGE_SLACK_MS past it are
//   deleted with their messages, in case the policy isn't deployed.
//
// Conversations are found by idleDueAt, when the next check-in or resolve
// falls due: set by the bot's replies (supportBotHandler.ts) and the
// check-in, cleared by the member, the team, an escalation or a resolve. Only
// conversations with work due are read, so chats with the team or already
// over never crowd out the ones waiting. A due conversation is checked
// against idleAction first; one with nothing to do after all gets its
// idleDueAt moved to when it will, or cleared.
//
// Each change is claimed in a transaction first, so overlapping runs never
// send twice. Conversations go SWEEP_BATCH at a time, and no new batch starts
// after SWEEP_DEADLINE_MS (the route has 60 s): what's left is due next run.
// Firestore is getAdminDb()'s project, which lib/firebase/envGuard.ts pins:
// the dev project locally and on Vercel Preview, production on Production.

const SWEEP_LIMIT = 200
const SWEEP_BATCH = 10
export const SWEEP_DEADLINE_MS = 50_000
const PURGE_LIMIT = 500
export const PURGE_SLACK_MS = 3 * 24 * 60 * 60 * 1000
const PHONE_NUMBER_ID = /^\d{1,32}$/
/** What the team sees in the transcript when the sweep resolves a chat; the member gets nothing. */
export const AUTO_RESOLVED_NOTE = 'Auto-resolved: no reply to the check-in'

const millis = (value: unknown) => (value instanceof Timestamp ? value.toMillis() : undefined)

export type IdleAction = 'checkIn' | 'resolve'

/** When the sweep next has work for this conversation (ms): its check-in, or its resolve; undefined for none until something changes. */
export function nextIdleDue(data: DocumentData, now: number, idle = idleMs()): number | undefined {
  const status = currentStatus({
    status: isConversationStatus(data.status) ? data.status : undefined,
    escalatedAt: millis(data.escalatedAt),
    inquiryPromptedAt: millis(data.inquiryPromptedAt),
    now,
  })
  // A person has it, or it's over: nothing to chase.
  if (status === 'escalated' || status === 'resolved') return undefined
  const lastInbound = millis(data.lastInboundAt)
  const checkedIn = millis(data.idleCheckInAt)
  // Checked in: resolved after the grace period, unless the member has written since.
  if (checkedIn !== undefined) return lastInbound !== undefined && lastInbound >= checkedIn ? undefined : checkedIn + IDLE_GRACE_MS
  const lastOutbound = millis(data.lastOutboundAt)
  if (lastInbound === undefined || lastOutbound === undefined || lastOutbound <= lastInbound) return undefined
  // A check-in can only be sent while Meta's window is open, now and when it falls due.
  const windowCloses = lastInbound + CUSTOMER_SERVICE_WINDOW_MS
  const due = lastOutbound + idle
  return now < windowCloses && due < windowCloses ? due : undefined
}

/** What the sweep does to a conversation now, if anything: whatever nextIdleDue says has fallen due. */
export function idleAction(data: DocumentData, now: number, idle = idleMs()): IdleAction | null {
  const due = nextIdleDue(data, now, idle)
  if (due === undefined || now < due) return null
  return millis(data.idleCheckInAt) !== undefined ? 'resolve' : 'checkIn'
}

export interface SweepResult {
  checkedIn: number
  resolved: number
  purged: number
}

/** `deadline` is wall-clock time (ms): no new batch starts after it. */
export async function sweepIdleConversations(now = Date.now(), deadline = Date.now() + SWEEP_DEADLINE_MS): Promise<SweepResult> {
  const db = getAdminDb()
  const conversations = db.collection('whatsappConversations')
  const idle = idleMs()
  const result: SweepResult = { checkedIn: 0, resolved: 0, purged: 0 }

  const due = await conversations.where('idleDueAt', '<=', Timestamp.fromMillis(now)).orderBy('idleDueAt').limit(SWEEP_LIMIT).get()
  const sweepOne = async (doc: (typeof due.docs)[number]) => {
    const expected = idleAction(doc.data(), now, idle)
    try {
      const claimed = await claim(doc.ref, now, idle, expected)
      if (!claimed) return
      if (expected === 'checkIn') {
        await checkIn(doc.id, claimed, now)
        result.checkedIn++
      } else {
        result.resolved++
        await logMessages(doc.id, [{ direction: 'out', author: 'system', kind: 'note', text: AUTO_RESOLVED_NOTE, at: now }])
      }
    } catch (err) {
      console.error(`[whatsapp-idle] ${expected ?? 'rescheduling'} for ${maskPhone(`+${doc.id}`)} failed:`, err instanceof Error ? err.message : err)
    }
  }
  for (let i = 0; i < due.docs.length; i += SWEEP_BATCH) {
    if (Date.now() >= deadline) {
      console.warn(`[whatsapp-idle] out of time: ${due.docs.length - i} due conversation(s) left for the next run`)
      break
    }
    await Promise.all(due.docs.slice(i, i + SWEEP_BATCH).map(sweepOne))
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

/**
 * Applies `action` if it is still what's due, in a transaction; resolves to
 * the conversation as it was, or null. Otherwise (nothing to do, or the
 * conversation moved on since it was read) idleDueAt is moved to when the
 * sweep next has work there, or cleared, so it isn't read again for nothing.
 */
async function claim(ref: DocumentReference, now: number, idle: number, action: IdleAction | null): Promise<DocumentData | null> {
  return getAdminDb().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref)
    const data = snapshot.data()
    if (!data) return null
    const clear = FieldValue.delete()
    if (!action || idleAction(data, now, idle) !== action) {
      // Already due again (it changed since it was read): the next run takes it.
      const next = nextIdleDue(data, now, idle)
      tx.set(ref, { idleDueAt: next !== undefined ? Timestamp.fromMillis(next) : clear }, { merge: true })
      return null
    }
    const at = Timestamp.fromMillis(now)
    if (action === 'checkIn') {
      const awaitingInquiry = currentStatus({ status: isConversationStatus(data.status) ? data.status : undefined, inquiryPromptedAt: millis(data.inquiryPromptedAt), now }) === 'awaiting_user_inquiry'
      tx.set(ref, { idleCheckInAt: at, idleDueAt: Timestamp.fromMillis(now + IDLE_GRACE_MS), ...(awaitingInquiry ? { idleResume: 'inquiry' } : {}) }, { merge: true })
    } else {
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
          idleDueAt: clear,
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
    recordUsage('whatsapp.simulated')
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
