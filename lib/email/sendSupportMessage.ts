import 'server-only'
import { buildTeamInboxEmail, sendToTeamInbox } from './teamInboxEmail'
import { isValidEmail, multiLine, singleLine } from './formFields'

// The /support "Send Us a Message" form, delivered to the team inbox
// (teamInboxEmail.ts) with Reply-To set to the sender.

export const SUPPORT_SUBJECTS = {
  general: 'General question',
  billing: 'Billing and payments',
  voucher: 'Voucher issue',
  partner: 'Partner inquiry',
  aliyah: 'Aliyah support',
} as const
export type SupportSubject = keyof typeof SUPPORT_SUBJECTS

export const SUPPORT_LIMITS = { name: 100, email: 254, message: 5000 } as const

export interface SupportMessage {
  name: string
  email: string
  subject: SupportSubject
  message: string
  lang: string
}

/** Cleans the raw request body, or returns null when any field is missing or invalid. */
export function parseSupportMessage(body: unknown): SupportMessage | null {
  if (!body || typeof body !== 'object') return null
  const raw = body as Record<string, unknown>
  if (typeof raw.name !== 'string' || typeof raw.email !== 'string' || typeof raw.message !== 'string') return null
  const name = singleLine(raw.name)
  const email = singleLine(raw.email)
  const message = multiLine(raw.message)
  const subject = typeof raw.subject === 'string' && Object.hasOwn(SUPPORT_SUBJECTS, raw.subject)
    ? (raw.subject as SupportSubject)
    : 'general'
  const lang = typeof raw.lang === 'string' ? singleLine(raw.lang).slice(0, 8) : ''
  if (!name || name.length > SUPPORT_LIMITS.name) return null
  if (!isValidEmail(email, SUPPORT_LIMITS.email)) return null
  if (!message || message.length > SUPPORT_LIMITS.message) return null
  return { name, email, subject, message, lang }
}

function supportEmail(msg: SupportMessage) {
  const topic = SUPPORT_SUBJECTS[msg.subject]
  return {
    subject: `[Landly Support] ${topic} — ${msg.name}`,
    heading: 'New support message',
    rows: [
      { label: 'Name', value: msg.name },
      { label: 'Email', value: msg.email, href: `mailto:${msg.email}` },
      { label: 'Subject', value: topic },
      { label: 'Site language', value: msg.lang || 'unknown' },
    ],
    message: msg.message,
    replyName: msg.name,
    source: 'the Landly support form',
  }
}

export function buildSupportEmail(msg: SupportMessage) {
  return buildTeamInboxEmail(supportEmail(msg))
}

export async function sendSupportMessage(msg: SupportMessage): Promise<void> {
  await sendToTeamInbox({ ...supportEmail(msg), replyTo: msg.email })
}
