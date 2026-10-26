import 'server-only'
import { FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore'
import { maskPhone } from '@/lib/auth/phoneVerification'
import { getAdminDb } from '@/lib/firebase/admin'
import type { Lang } from '@/lib/i18n/translations'
import { recordUsage } from '@/lib/usage/recordUsage'
import { isAttachmentKind, logMessages, MESSAGE_TTL_MS, snippetOf, type LoggedMedia, type LoggedMessage, type MessageAuthor, type MessageKind } from './conversationLog'
import { mediaUrls } from './mediaUrls'
import { sendWhatsAppMessage, WhatsAppApiError, whatsappLive, type WhatsAppMessage } from './graph'
import {
  currentStatus,
  CUSTOMER_SERVICE_WINDOW_MS,
  isConversationStatus,
  isInquiryCategory,
  teamResolvedMessage,
  transcriptText,
  type ConversationStatus,
  type InquiryCategory,
} from './supportBot'
import { idleSchedule, nextIdleDue } from './idleSweep'
import { isBotLanguage } from './webhookPayload'

// The support inbox behind /admin/support (app/api/admin/whatsapp/*): the
// conversation list, one chat's transcript, a reply from the team and a
// status change. Replies are plain text from the number the member last
// wrote to, as Landly, and only inside Meta's 24-hour customer-service
// window. A reply keeps the conversation escalated (and refreshes
// escalatedAt) so the bot stays quiet while a person is answering, and
// starts the clock on the team's follow-up and silent resolve
// (lib/whatsapp/idleSweep.ts) should the member not answer. Anything the
// team does answers the bot's idle check-in; a status change stops the
// follow-up clock. A message sent moves the conversation's expiresAt to 180
// days after it.
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
  /** The team spoke last and the member hasn't answered: the follow-up (sentAt once it went out) and the silent resolve that come next. */
  followUp: { stage: 'nudge' | 'resolve'; sentAt: string | null; dueAt: string } | null
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
  /** A member's attachment (kind image/video/audio/document); `text` is its caption. */
  media?: InboxMedia
}

/** An attachment as the inbox gets it: signed URLs, never the Storage path. */
export interface InboxMedia {
  status: LoggedMedia['status']
  mimeType?: string
  filename?: string
  size?: number
  voice?: true
  /** Shows or plays it in the page; images, video and audio only. */
  url?: string
  /** Saves it under its name. */
  downloadUrl?: string
  /** Audio only: its bytes from our own origin (admin session), for decoding where the browser can't play the format. */
  fileUrl?: string
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
    followUp: followUpOf(data, now),
  }
}

/** What the sweep has scheduled for the team's side of the conversation, while it has (idleDueAt is set). */
function followUpOf(data: DocumentData, now: number): InboxConversation['followUp'] {
  if (!(data.idleDueAt instanceof Timestamp)) return null
  const next = idleSchedule(data, now)
  if (next?.action !== 'teamNudge' && next?.action !== 'teamResolve') return null
  return { stage: next.action === 'teamNudge' ? 'nudge' : 'resolve', sentAt: iso(data.teamNudgeAt), dueAt: new Date(next.at).toISOString() }
}

function toInboxMessage(id: string, data: DocumentData): InboxMessage {
  return {
    id,
    direction: data.direction === 'out' ? 'out' : 'in',
    author: data.author === 'bot' || data.author === 'admin' || data.author === 'system' ? data.author : 'member',
    kind: data.kind ?? 'text',
    text: typeof data.text === 'string' ? data.text : '',
    at: iso(data.at) ?? '',
    ...(data.simulated ? { simulated: true as const } : {}),
    ...(typeof data.error === 'string' ? { error: data.error } : {}),
    ...(isAttachmentKind(data.kind) ? { media: toInboxMedia(data.media) } : {}),
  }
}

const MEDIA_STATUSES: readonly LoggedMedia['status'][] = ['stored', 'too_large', 'failed', 'unavailable']

function toInboxMedia(raw: unknown): InboxMedia {
  const media = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const status = MEDIA_STATUSES.find((s) => s === media.status) ?? 'failed'
  return {
    status,
    ...(typeof media.mimeType === 'string' ? { mimeType: media.mimeType } : {}),
    ...(typeof media.filename === 'string' ? { filename: media.filename } : {}),
    ...(typeof media.size === 'number' ? { size: media.size } : {}),
    ...(media.voice === true ? { voice: true as const } : {}),
  }
}

/** The same-origin address of a stored attachment's bytes (app/api/admin/whatsapp/media/route.ts). */
export const mediaFileUrl = (waId: string, messageId: string) => `/api/admin/whatsapp/media?waId=${encodeURIComponent(waId)}&id=${encodeURIComponent(messageId)}`

/** The transcript entry with its attachment's URLs signed, when it has a stored one. */
async function withMediaUrls(waId: string, message: InboxMessage, data: DocumentData, now: number): Promise<InboxMessage> {
  if (!message.media || !isAttachmentKind(message.kind) || message.media.status !== 'stored' || typeof data.media?.path !== 'string') return message
  const at = data.at instanceof Timestamp ? data.at.toMillis() : now
  const urls = await mediaUrls(message.kind, { status: 'stored', path: data.media.path, filename: message.media.filename }, at, now)
  // Audio the browser can't play is decoded in the page, which needs its bytes from our own origin.
  const fileUrl = message.kind === 'audio' && urls.url ? { fileUrl: mediaFileUrl(waId, message.id) } : {}
  return { ...message, media: { ...message.media, ...urls, ...fileUrl } }
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
    messages: (await Promise.all(messages.docs.map((doc) => withMediaUrls(waId, toInboxMessage(doc.id, doc.data()), doc.data(), now)))).reverse(),
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
  // The team spoke last: its follow-up falls due, unless the member answers first.
  const followUpDue = nextIdleDue({ ...data, status: 'escalated', lastAdminReplyAt: at, teamNudgeAt: undefined, idleCheckInAt: undefined }, now)
  await ref.set(
    {
      status: 'escalated',
      escalatedAt: at,
      lastAdminReplyAt: at,
      lastOutboundAt: at,
      lastSnippet: snippetOf(logged.entry),
      expiresAt: Timestamp.fromMillis(now + MESSAGE_TTL_MS),
      inquiryPromptedAt: FieldValue.delete(),
      idleCheckInAt: FieldValue.delete(),
      idleResume: FieldValue.delete(),
      teamNudgeAt: FieldValue.delete(),
      idleDueAt: followUpDue !== undefined ? Timestamp.fromMillis(followUpDue) : FieldValue.delete(),
    },
    { merge: true }
  )
  return { ok: true, message: logged.message }
}

export type StatusResult = { ok: true; conversation: InboxConversation; notified: boolean } | { ok: false; error: 'not_found' }

/**
 * Sets the status the way the bot would: resolved clears the escalation and
 * the menu timers (and, with `notify`, thanks the member while the window is
 * open); escalated silences the bot for another 24 hours; active hands the
 * conversation back to the bot. Each stops the follow-up clock; only the
 * team's next reply starts it again.
 */
export async function setConversationStatus(waId: string, status: AdminStatus, notify = true, now = Date.now()): Promise<StatusResult> {
  const ref = conversations().doc(waId)
  const snapshot = await ref.get()
  if (!snapshot.exists) return { ok: false, error: 'not_found' }
  const data = snapshot.data()!
  const at = Timestamp.fromMillis(now)
  const clear = FieldValue.delete()
  const update: Record<string, unknown> = { status, inquiryPromptedAt: clear, idleCheckInAt: clear, idleResume: clear, teamNudgeAt: clear, idleDueAt: clear }
  if (status === 'escalated') update.escalatedAt = at
  if (status === 'active') update.escalatedAt = clear
  if (status === 'resolved') Object.assign(update, { resolvedAt: at, escalatedAt: clear, lastMenuAt: clear, lastNudgeAt: clear })

  let notified = false
  if (status === 'resolved' && notify && toInboxConversation(waId, data, now).windowOpen) {
    const lang = isBotLanguage(data.lang) ? data.lang : 'en'
    const logged = await sendAndLog(waId, data, teamResolvedMessage(lang), now)
    notified = !logged.error
    if (notified) Object.assign(update, { lastOutboundAt: at, lastSnippet: snippetOf(logged.entry), expiresAt: Timestamp.fromMillis(now + MESSAGE_TTL_MS) })
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
    recordUsage('whatsapp.simulated')
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
