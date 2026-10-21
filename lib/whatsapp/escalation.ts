import 'server-only'
import { SUPPORT_EMAIL } from '@/lib/config'
import { sendToTeamInbox } from '@/lib/email/teamInboxEmail'
import type { Lang } from '@/lib/i18n/translations'

// "Talk to Team" in the WhatsApp support bot: an email to the team inbox
// with who asked and a wa.me link that opens the chat with them, so the
// team can answer the member directly.

export interface Escalation {
  waId: string
  lang: Lang
  /** The member's name, else their WhatsApp profile name. */
  name?: string
  uid?: string
  email?: string
  /** The last thing they typed before asking, if anything. */
  lastText?: string
}

export function escalationEmail({ waId, lang, name, uid, email, lastText }: Escalation) {
  const who = name || `+${waId}`
  return {
    subject: `WhatsApp: ${who} asked to talk to the team`,
    heading: 'A member asked to talk to the team on WhatsApp',
    rows: [
      { label: 'Name', value: name || '(not shared)' },
      { label: 'WhatsApp', value: `+${waId}`, href: `https://wa.me/${waId}` },
      { label: 'Member UID', value: uid ?? 'No Landly account matches this number' },
      ...(email ? [{ label: 'Email', value: email, href: `mailto:${email}` }] : []),
      { label: 'Language', value: lang },
    ],
    message: lastText || '(They tapped "Talk to Team" without writing a message.)',
    replyName: who,
    source: 'the Landly WhatsApp support bot',
    // Without a known email, Reply comes back to the team inbox; the wa.me link is the way to answer.
    replyTo: email || SUPPORT_EMAIL,
  }
}

export function notifyTeam(escalation: Escalation): Promise<void> {
  return sendToTeamInbox(escalationEmail(escalation))
}
