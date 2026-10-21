// What the support bot needs from Meta's webhook POST
// (object: whatsapp_business_account → entry[] → changes[] → value), as a
// flat list: one event per incoming message. Delivery statuses, other
// fields and other numbers on the same business account are skipped.

export type BotAction = 'perks' | 'pass' | 'team'

export const isBotAction = (value: unknown): value is BotAction => value === 'perks' || value === 'pass' || value === 'team'

interface InboundBase {
  /** Meta's message id (wamid…), unique per message; retries repeat it. */
  messageId: string
  /** The sender's WhatsApp ID: their number's digits, no "+". */
  waId: string
  /** The sender's WhatsApp profile name, when Meta shares it. */
  name?: string
  /** When the member sent it, in ms. */
  at: number
}

export type InboundEvent =
  | (InboundBase & { kind: 'text'; text: string })
  | (InboundBase & { kind: 'button'; action: BotAction })
  /** An image, voice note, sticker, location, or a button we don't know: answered with the menu. */
  | (InboundBase & { kind: 'other' })

type Raw = Record<string, unknown>
const obj = (v: unknown): Raw | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : undefined)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

const MAX_TEXT = 2000

export function parseWebhookPayload(body: unknown, phoneNumberId?: string): InboundEvent[] {
  const root = obj(body)
  if (root?.object !== 'whatsapp_business_account') return []
  const events: InboundEvent[] = []
  for (const entry of arr(root.entry)) {
    for (const change of arr(obj(entry)?.changes)) {
      if (obj(change)?.field !== 'messages') continue
      const value = obj(obj(change)?.value)
      if (!value) continue
      if (phoneNumberId && obj(value.metadata)?.phone_number_id !== phoneNumberId) continue
      const names = new Map<string, string>()
      for (const contact of arr(value.contacts)) {
        const waId = str(obj(contact)?.wa_id)
        const name = str(obj(obj(contact)?.profile)?.name)
        if (waId && name) names.set(waId, name)
      }
      for (const raw of arr(value.messages)) {
        const event = parseMessage(obj(raw), names)
        if (event) events.push(event)
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
    const id = obj(obj(message.interactive)?.button_reply)?.id
    return isBotAction(id) ? { ...base, kind: 'button', action: id } : { ...base, kind: 'other' }
  }
  // A template's quick-reply button.
  if (message.type === 'button') {
    const payload = obj(message.button)?.payload
    return isBotAction(payload) ? { ...base, kind: 'button', action: payload } : { ...base, kind: 'other' }
  }
  // Meta's own notices (e.g. "system" number changes) and reactions get no menu.
  if (message.type === 'system' || message.type === 'reaction' || message.type === 'unsupported') return null
  return { ...base, kind: 'other' }
}
