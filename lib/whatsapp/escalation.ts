import 'server-only'
import { SUPPORT_EMAIL } from '@/lib/config'
import { sendToTeamInbox } from '@/lib/email/teamInboxEmail'
import type { Lang } from '@/lib/i18n/translations'
import { INQUIRY_CATEGORY_LABELS, type InquiryCategory } from './supportBot'

// "Talk to Team" in the WhatsApp support bot: once the member has described
// their request, an email to the team inbox with what they wrote, who they
// are, a link to the chat in the admin support inbox (/admin/support) and a
// wa.me link as the fallback, so the team can answer the member directly.

export interface Escalation {
  waId: string
  lang: Lang
  /** The site origin (APP_URL), for the admin inbox link. */
  origin: string
  /** The member's name, else their WhatsApp profile name. */
  name?: string
  uid?: string
  email?: string
  /** What they wrote when asked to describe their request; missing when they sent a photo, voice note or the like. */
  inquiry?: string
  /** The bot topic they asked from. */
  category?: InquiryCategory
}

export function escalationEmail({ waId, lang, origin, name, uid, email, inquiry, category = 'general' }: Escalation) {
  const who = name || `+${waId}`
  return {
    subject: `WhatsApp: ${who} asked to talk to the team`,
    heading: 'A member asked to talk to the team on WhatsApp',
    rows: [
      { label: 'Topic', value: INQUIRY_CATEGORY_LABELS[category] },
      { label: 'Name', value: name || '(not shared)' },
      { label: 'Support inbox', value: 'Open the chat in Landly Admin', href: `${origin}/admin/support?c=${waId}` },
      { label: 'WhatsApp', value: `+${waId}`, href: `https://wa.me/${waId}` },
      { label: 'Member UID', value: uid ?? 'No Landly account matches this number' },
      ...(email ? [{ label: 'Email', value: email, href: `mailto:${email}` }] : []),
      { label: 'Language', value: lang },
    ],
    message: inquiry || '(They answered with a photo, voice note or other attachment; open the chat to see it.)',
    replyName: who,
    source: 'the Landly WhatsApp support bot',
    // Without a known email, Reply comes back to the team inbox; the links are the way to answer.
    replyTo: email || SUPPORT_EMAIL,
  }
}

export function notifyTeam(escalation: Escalation): Promise<void> {
  return sendToTeamInbox(escalationEmail(escalation))
}
