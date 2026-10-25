// What the support bot needs from Meta's webhook POST
// (object: whatsapp_business_account → entry[] → changes[] → value), as a
// flat list: one event per incoming message. Delivery statuses and other
// fields are skipped. Messages to any number on the business account are
// kept, each event naming the number it was sent to (the bot answers from
// it), so a WHATSAPP_PHONE_NUMBER_ID that lags behind the registered line
// costs nothing; the delivery is signed by our app, so the number is ours.

import type { Lang } from '@/lib/i18n/translations'

/** The reply-button ids the bot sends (lib/whatsapp/supportBot.ts); menus sent as lists before still answer with the same ids. */
export const BOT_ACTIONS = [
  'btn_perks',
  'btn_pass',
  'btn_talk_to_team',
  'btn_escalate_prompt',
  'btn_escalate_order',
  'btn_escalate_purchase',
  'btn_cancel_inquiry',
  'btn_ticket_resolved',
  'btn_back_to_menu',
  // The idle check-in's buttons.
  'btn_idle_yes',
  'btn_idle_done',
  // The main menu's buttons.
  'menu_order',
  'menu_new_order',
  'menu_pass',
  'menu_agent',
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

/** The languages the bot offers, in the picker's order; each button's id is `lang_<code>`. */
export const BOT_LANGUAGES = ['en', 'he', 'ru', 'fr', 'es'] as const satisfies readonly Lang[]

export const isBotLanguage = (value: unknown): value is Lang => (BOT_LANGUAGES as readonly unknown[]).includes(value)

/** The language a picker button id stands for, or undefined for any other id. */
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
  /** A reply button tapped, or a row picked from one of the bot's older list menus. */
  | (InboundBase & { kind: 'button'; action: BotAction })
  /** A language button tapped (or a row picked from the older language list). */
  | (InboundBase & { kind: 'language'; lang: Lang })
  /** An image, voice note, sticker, location, or a button we don't know: answered with the menu. `media` is Meta's message type. */
  | (InboundBase & { kind: 'other'; media?: string })

type Raw = Record<string, unknown>
const obj = (v: unknown): Raw | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : undefined)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

const MAX_TEXT = 2000
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
    // Lists are no longer sent, but older ones still sit in members' chats.
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
  const media = str(message.type)
  return media ? { ...base, kind: 'other', media: media.slice(0, 32) } : { ...base, kind: 'other' }
}
