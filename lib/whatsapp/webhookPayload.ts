// What the support bot needs from Meta's webhook POST
// (object: whatsapp_business_account → entry[] → changes[] → value), as a
// flat list: one event per incoming message. Delivery statuses and other
// fields are skipped. Messages to any number on the business account are
// kept, each event naming the number it was sent to (the bot answers from
// it), so a WHATSAPP_PHONE_NUMBER_ID that lags behind the registered line
// costs nothing; the delivery is signed by our app, so the number is ours.

import type { Lang } from '@/lib/i18n/translations'

/** The reply-button and list-row ids the bot sends (lib/whatsapp/supportBot.ts); a tap answers with the id either way. */
export const BOT_ACTIONS = [
  'btn_perks',
  'btn_pass',
  'btn_talk_to_team',
  'btn_escalate_prompt',
  'btn_escalate_order',
  'btn_escalate_purchase',
  'btn_escalate_login',
  'btn_cancel_inquiry',
  'btn_ticket_resolved',
  'btn_back_to_menu',
  // The idle check-in's buttons.
  'btn_idle_yes',
  'btn_idle_done',
  // The team's follow-up: Still need help (its All set is btn_idle_done).
  'btn_team_nudge_yes',
  // The main menu's rows.
  'menu_order',
  'menu_new_order',
  'menu_pass',
  'menu_agent',
  'menu_login_help',
  'menu_lang',
  // The "Existing order" and "My Pass & perks" buttons.
  'opt_vouchers',
  'opt_venue',
  'opt_refund',
  'opt_pass',
  'opt_perks',
  'opt_account',
] as const

export type BotAction = (typeof BOT_ACTIONS)[number]

// Menus sent before the btn_* ids still sit in members' chats, and still work.
const LEGACY_ACTIONS: Record<string, BotAction> = { perks: 'btn_perks', pass: 'btn_pass', team: 'btn_talk_to_team' }

/** The languages the bot offers, in the picker's order; each row's id is `lang_<code>`. */
export const BOT_LANGUAGES = ['en', 'he', 'ru', 'fr', 'es'] as const satisfies readonly Lang[]

export const isBotLanguage = (value: unknown): value is Lang => (BOT_LANGUAGES as readonly unknown[]).includes(value)

/** The language a picker row id stands for, or undefined for any other id. */
export function toBotLanguage(value: unknown): Lang | undefined {
  if (typeof value !== 'string' || !value.startsWith('lang_')) return undefined
  const code = value.slice('lang_'.length)
  return isBotLanguage(code) ? code : undefined
}

/** The action a button id stands for, or undefined for an id the bot never sent. */
export function toBotAction(value: unknown): BotAction | undefined {
  if (typeof value !== 'string') return undefined
  if ((BOT_ACTIONS as readonly string[]).includes(value)) return value as BotAction
  return Object.hasOwn(LEGACY_ACTIONS, value) ? LEGACY_ACTIONS[value] : undefined
}

interface InboundBase {
  /** Meta's message id (wamid…), unique per message; retries repeat it. */
  messageId: string
  /** The sender's WhatsApp ID: their number's digits, no "+". */
  waId: string
  /** The sender's WhatsApp profile name, when Meta shares it. */
  name?: string
  /** When the member sent it, in ms. */
  at: number
  /** The receiving number's ID (metadata.phone_number_id); replies leave from it. */
  phoneNumberId?: string
}

export type InboundEvent =
  | (InboundBase & { kind: 'text'; text: string })
  /** A reply button tapped, or a row picked from a list menu. */
  | (InboundBase & { kind: 'button'; action: BotAction })
  /** A language picked from the language list (or a button of the older picker). */
  | (InboundBase & { kind: 'language'; lang: Lang })
  /** A photo, video, audio clip or voice note, or a file: stored for the inbox (lib/whatsapp/mediaStore.ts) and answered like 'other'. */
  | (InboundBase & { kind: 'media'; media: InboundMedia })
  /** A sticker, location, contact card, or a button we don't know: answered with the menu. `media` is Meta's message type. */
  | (InboundBase & { kind: 'other'; media?: string })

export const MEDIA_TYPES = ['image', 'video', 'audio', 'document'] as const
export type MediaType = (typeof MEDIA_TYPES)[number]

/** An attachment as the webhook names it; the file itself is fetched from Meta by `mediaId`. */
export interface InboundMedia {
  type: MediaType
  /** Meta's media id: GET /{version}/{mediaId} gives a short-lived download URL. Missing when the webhook's was unusable: the attachment still shows, as not saved. */
  mediaId?: string
  /** As the member's phone reported it; mediaStore checks it against what is downloaded. */
  mimeType?: string
  /** Base64 or hex, as Meta sends it. */
  sha256?: string
  caption?: string
  /** A document's file name. */
  filename?: string
  /** An audio message recorded in WhatsApp (a voice note), not a shared audio file. */
  voice?: boolean
}

type Raw = Record<string, unknown>
const obj = (v: unknown): Raw | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : undefined)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

const MAX_TEXT = 2000
const MAX_CAPTION = 1024
const MAX_FILENAME = 240
const MEDIA_ID = /^[A-Za-z0-9_-]{1,128}$/
const isMediaType = (value: unknown): value is MediaType => (MEDIA_TYPES as readonly unknown[]).includes(value)
const PHONE_NUMBER_ID = /^\d{1,32}$/

/** metadata.phone_number_id of a change's value, when it's a well-formed ID (it goes into the Graph URL). */
function receivingId(value: Raw): string | undefined {
  const id = str(obj(value.metadata)?.phone_number_id)
  return id && PHONE_NUMBER_ID.test(id) ? id : undefined
}

/** Every receiving number ID in a delivery, messages or not -- for the webhook's request log. */
export function payloadPhoneNumberIds(body: unknown): string[] {
  const root = obj(body)
  if (root?.object !== 'whatsapp_business_account') return []
  const ids = new Set<string>()
  for (const entry of arr(root.entry)) {
    for (const change of arr(obj(entry)?.changes)) {
      const value = obj(obj(change)?.value)
      const id = value && str(obj(value.metadata)?.phone_number_id)
      if (id) ids.add(id.slice(0, 32))
    }
  }
  return [...ids]
}

/** `configuredId` is WHATSAPP_PHONE_NUMBER_ID: a message to another number is still ingested, with a log line. */
export function parseWebhookPayload(body: unknown, configuredId?: string): InboundEvent[] {
  const root = obj(body)
  if (root?.object !== 'whatsapp_business_account') return []
  const events: InboundEvent[] = []
  for (const entry of arr(root.entry)) {
    for (const change of arr(obj(entry)?.changes)) {
      if (obj(change)?.field !== 'messages') continue
      const value = obj(obj(change)?.value)
      if (!value) continue
      const incomingId = receivingId(value)
      // Statuses for other numbers are routine; only messages are worth a line.
      if (configuredId && incomingId !== configuredId && arr(value.messages).length) {
        console.info(`[whatsapp-webhook] Ingesting message for phone ID: ${incomingId ?? 'missing'} (configured env: ${configuredId})`)
      }
      const names = new Map<string, string>()
      for (const contact of arr(value.contacts)) {
        const waId = str(obj(contact)?.wa_id)
        const name = str(obj(obj(contact)?.profile)?.name)
        if (waId && name) names.set(waId, name)
      }
      for (const raw of arr(value.messages)) {
        const event = parseMessage(obj(raw), names)
        if (event) events.push(incomingId ? { ...event, phoneNumberId: incomingId } : event)
      }
    }
  }
  return events
}

function parseMessage(message: Raw | undefined, names: Map<string, string>): InboundEvent | null {
  const messageId = str(message?.id)
  const waId = str(message?.from)
  if (!message || !messageId || !waId || !/^\d{6,15}$/.test(waId)) return null
  const seconds = Number(message.timestamp)
  const base: InboundBase = { messageId, waId, name: names.get(waId), at: Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : Date.now() }

  if (message.type === 'text') {
    const text = str(obj(message.text)?.body)
    return text ? { ...base, kind: 'text', text: text.slice(0, MAX_TEXT) } : { ...base, kind: 'other' }
  }
  if (message.type === 'interactive') {
    const interactive = obj(message.interactive)
    // A reply button or a list row: the bot gives both the same ids.
    const id = obj(interactive?.button_reply)?.id ?? obj(interactive?.list_reply)?.id
    const lang = toBotLanguage(id)
    if (lang) return { ...base, kind: 'language', lang }
    const action = toBotAction(id)
    return action ? { ...base, kind: 'button', action } : { ...base, kind: 'other', media: 'interactive' }
  }
  // A template's quick-reply button.
  if (message.type === 'button') {
    const action = toBotAction(obj(message.button)?.payload)
    return action ? { ...base, kind: 'button', action } : { ...base, kind: 'other', media: 'button' }
  }
  // Meta's own notices (e.g. "system" number changes) and reactions get no menu.
  if (message.type === 'system' || message.type === 'reaction' || message.type === 'unsupported') return null
  if (isMediaType(message.type)) return { ...base, kind: 'media', media: parseMedia(message.type, obj(message[message.type]), messageId) }
  const media = str(message.type)
  return media ? { ...base, kind: 'other', media: media.slice(0, 32) } : { ...base, kind: 'other' }
}

/** The image/video/audio/document object of a message; without a usable id it keeps its type, and mediaStore records it as not saved. */
function parseMedia(type: MediaType, raw: Raw = {}, messageId: string): InboundMedia {
  const id = str(raw.id)
  const mediaId = id && MEDIA_ID.test(id) ? id : undefined
  if (!mediaId) console.warn(`[whatsapp-webhook] ${type} message ${messageId.slice(0, 64)} has no usable media id; it will show as not saved`)
  const mimeType = str(raw.mime_type)?.slice(0, 128)
  const sha256 = str(raw.sha256)?.slice(0, 128)
  // Audio and stickers carry no caption.
  const caption = type === 'audio' ? undefined : str(raw.caption)?.slice(0, MAX_CAPTION)
  const filename = type === 'document' ? str(raw.filename)?.slice(0, MAX_FILENAME) : undefined
  return {
    type,
    ...(mediaId ? { mediaId } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(sha256 ? { sha256 } : {}),
    ...(caption ? { caption } : {}),
    ...(filename ? { filename } : {}),
    ...(type === 'audio' && raw.voice === true ? { voice: true } : {}),
  }
}
