import 'server-only'
import { FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore'
import { maskPhone } from '@/lib/auth/phoneVerification'
import { getAdminDb } from '@/lib/firebase/admin'
import type { Lang } from '@/lib/i18n/translations'
import { logMessages, snippetOf, type LoggedMessage, type MessageAuthor, type MessageKind } from './conversationLog'
import { sendWhatsAppMessage, WhatsAppApiError, whatsappLive, type WhatsAppMessage } from './graph'
import {
  currentStatus,
  CUSTOMER_SERVICE_WINDOW_MS,
  isConversationStatus,
  isInquiryCategory,
  resolvedMessage,
  transcriptText,
  type ConversationStatus,
  type InquiryCategory,
} from './supportBot'
import { isBotLanguage } from './webhookPayload'

// The support inbox behind /admin/support (app/api/admin/whatsapp/*): the
// conversation list, one chat's transcript, a reply from the team and a
// status change. Replies are plain text from the number the member last
// wrote to, as Landly, and only inside Meta's 24-hour customer-service
// window. A reply keeps the conversation escalated (and refreshes
// escalatedAt) so the bot stays quiet while a person is answering.
//
// A conversation needs a reply while it is escalated and the member wrote
// after the team's last reply; that drives the "Awaiting reply" tab without
// any read-tracking writes.

export const WA_ID = /^\d{6,15}$/
export { REPLY_MAX } from './replyLimits'
const LIST_LIMIT = 200
const TRANSCRIPT_LIMIT = 200
const PHONE_NUMBER_ID = /^\d{1,32}$/

/** The statuses the team can set; awaiting_user_inquiry is the bot's alone. */
export const ADMIN_STATUSES = ['active', 'escalated', 'resolved'] as const
export type AdminStatus = (typeof ADMIN_STATUSES)[number]
export const isAdminStatus = (value: unknown): value is AdminStatus => (ADMIN_STATUSES as readonly unknown[]).includes(value)

export interface InboxConversation {
  waId: string
  name: string | null
  uid: string | null
  lang: Lang
  langSelected: boolean
  status: ConversationStatus
  /** The bot topic of the member's latest request to the team. */
  category: InquiryCategory | null
  needsReply: boolean
  /** Free-form replies are still allowed (within 24 hours of the member's last message). */
  windowOpen: boolean
  lastInboundAt: string | null
  lastSnippet: { text: string; direction: 'in' | 'out'; at: string } | null
}

export interface InboxMessage {
  id: string
  direction: 'in' | 'out'
  author: MessageAuthor
  kind: MessageKind
  text: string
  at: string
  simulated?: true
  error?: string
}

const millis = (value: unknown) => (value instanceof Timestamp ? value.toMillis() : undefined)
const iso = (value: unknown) => (value instanceof Timestamp ? value.toDate().toISOString() : null)
const nonEmpty = (value: unknown) => (typeof value === 'string' && value ? value : null)

export function toInboxConversation(waId: string, data: DocumentData, now: number): InboxConversation {
  const lastInbound = millis(data.lastInboundAt)
  const lastReply = millis(data.lastAdminReplyAt)
  const storedStatus = data.status
  const status = currentStatus({
    status: isConversationStatus(storedStatus) ? storedStatus : undefined,
    escalatedAt: millis(data.escalatedAt),
    inquiryPromptedAt: millis(data.inquiryPromptedAt),
    now,
  })
  const snippet = data.lastSnippet
  return {
    waId,
    name: nonEmpty(data.memberName) ?? nonEmpty(data.profileName),
    uid: nonEmpty(data.uid),
    lang: isBotLanguage(data.lang) ? data.lang : 'en',
    langSelected: data.langSelectedAt instanceof Timestamp,
    status,
    category: isInquiryCategory(data.inquiryCategory) ? data.inquiryCategory : null,
    needsReply: status === 'escalated' && lastInbound !== undefined && (lastReply === undefined || lastInbound > lastReply),
    windowOpen: lastInbound !== undefined && now - lastInbound < CUSTOMER_SERVICE_WINDOW_MS,
    lastInboundAt: iso(data.lastInboundAt),
    lastSnippet:
      snippet && typeof snippet.text === 'string' && (snippet.direction === 'in' || snippet.direction === 'out')
        ? { text: snippet.text, direction: snippet.direction, at: iso(snippet.at) ?? '' }
        : null,
  }
}

function toInboxMessage(id: string, data: DocumentData): InboxMessage {
  return {
    id,
    direction: data.direction === 'out' ? 'out' : 'in',
    author: data.author === 'bot' || data.author === 'admin' ? data.author : 'member',
    kind: data.kind ?? 'text',
    text: typeof data.text === 'string' ? data.text : '',
    at: iso(data.at) ?? '',
    ...(data.simulated ? { simulated: true as const } : {}),
    ...(typeof data.error === 'string' ? { error: data.error } : {}),
  }
}

const conversations = () => getAdminDb().collection('whatsappConversations')

/** The most recent conversations by the member's last message, newest first. */
export async function listConversations(now = Date.now()): Promise<InboxConversation[]> {
  const snapshot = await conversations().orderBy('lastInboundAt', 'desc').limit(LIST_LIMIT).get()
  return snapshot.docs.map((doc) => toInboxConversation(doc.id, doc.data(), now))
}

/** One conversation and its latest messages, oldest first; null when there is no such conversation. */
export async function getConversation(waId: string, now = Date.now()) {
  const ref = conversations().doc(waId)
  const [snapshot, messages] = await Promise.all([ref.get(), ref.collection('messages').orderBy('at', 'desc').limit(TRANSCRIPT_LIMIT).get()])
  if (!snapshot.exists) return null
  return {
    conversation: toInboxConversation(waId, snapshot.data()!, now),
    messages: messages.docs.map((doc) => toInboxMessage(doc.id, doc.data())).reverse(),
  }
}

export type ReplyResult =
  | { ok: true; message: InboxMessage }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'window_closed' }
  | { ok: false; error: 'send_failed'; code: string; message: InboxMessage }

/** Sends the team's text to the member, logs it, and keeps the bot quiet. */
export async function replyAsTeam(waId: string, text: string, now = Date.now()): Promise<ReplyResult> {
  const ref = conversations().doc(waId)
  const snapshot = await ref.get()
  if (!snapshot.exists) return { ok: false, error: 'not_found' }
  const data = snapshot.data()!
  if (!toInboxConversation(waId, data, now).windowOpen) return { ok: false, error: 'window_closed' }

  const logged = await sendAndLog(waId, data, { type: 'text', text: { body: text } }, now)
  if (logged.error) return { ok: false, error: 'send_failed', code: logged.code ?? 'unknown', message: logged.message }
  const at = Timestamp.fromMillis(now)
  await ref.set(
    {
      status: 'escalated',
      escalatedAt: at,
      lastAdminReplyAt: at,
      lastOutboundAt: at,
      lastSnippet: snippetOf(logged.entry),
      inquiryPromptedAt: FieldValue.delete(),
    },
    { merge: true }
  )
  return { ok: true, message: logged.message }
}

export type StatusResult = { ok: true; conversation: InboxConversation; notified: boolean } | { ok: false; error: 'not_found' }

/**
 * Sets the status the way the bot would: resolved clears the escalation and
 * the menu timers (and, with `notify`, sends the member's sign-off while the
 * window is open); escalated silences the bot for another 24 hours; active
 * hands the conversation back to the bot.
 */
export async function setConversationStatus(waId: string, status: AdminStatus, notify = true, now = Date.now()): Promise<StatusResult> {
  const ref = conversations().doc(waId)
  const snapshot = await ref.get()
  if (!snapshot.exists) return { ok: false, error: 'not_found' }
  const data = snapshot.data()!
  const at = Timestamp.fromMillis(now)
  const clear = FieldValue.delete()
  const update: Record<string, unknown> = { status, inquiryPromptedAt: clear }
  if (status === 'escalated') update.escalatedAt = at
  if (status === 'active') update.escalatedAt = clear
  if (status === 'resolved') Object.assign(update, { resolvedAt: at, escalatedAt: clear, lastMenuAt: clear, lastNudgeAt: clear })

  let notified = false
  if (status === 'resolved' && notify && toInboxConversation(waId, data, now).windowOpen) {
    const lang = isBotLanguage(data.lang) ? data.lang : 'en'
    const logged = await sendAndLog(waId, data, resolvedMessage(lang), now)
    notified = !logged.error
    if (notified) Object.assign(update, { lastOutboundAt: at, lastSnippet: snippetOf(logged.entry) })
  }
  await ref.set(update, { merge: true })
  const updated = await ref.get()
  return { ok: true, conversation: toInboxConversation(waId, updated.data()!, now), notified }
}

/** Sends from the number the member last wrote to (or logs it, when not live), and adds it to the transcript either way. */
async function sendAndLog(waId: string, data: DocumentData, message: WhatsAppMessage, now: number) {
  const phoneNumberId = typeof data.phoneNumberId === 'string' && PHONE_NUMBER_ID.test(data.phoneNumberId) ? data.phoneNumberId : undefined
  const entry: LoggedMessage = { direction: 'out', author: 'admin', kind: message.type === 'text' ? 'text' : 'interactive', text: transcriptText(message), at: now }
  let code: string | undefined
  const to = maskPhone(`+${waId}`)
  if (!whatsappLive(phoneNumberId)) {
    console.info(`[whatsapp-inbox] simulated team reply to ${to}: ${JSON.stringify(message)}`)
    entry.simulated = true
  } else {
    try {
      entry.id = await sendWhatsAppMessage(waId, message, phoneNumberId)
      console.info(`[whatsapp-inbox] sent team ${message.type} to ${to} from ${phoneNumberId ?? 'WHATSAPP_PHONE_NUMBER_ID'}`)
    } catch (err) {
      code = err instanceof WhatsAppApiError ? err.code : 'unknown'
      entry.error = err instanceof Error ? err.message : String(err)
      console.error(`[whatsapp-inbox] team reply to ${to} failed (${code}):`, entry.error)
    }
  }
  // Without an id, a generated one: the message still shows, and a failure shows as failed.
  const messages = conversations().doc(waId).collection('messages')
  const ref = entry.id ? messages.doc(entry.id) : messages.doc()
  entry.id = ref.id
  await logMessages(waId, [entry])
  return { entry, error: entry.error, code, message: toInboxMessage(ref.id, { ...entry, at: Timestamp.fromMillis(now) }) }
}
