import 'server-only'
import { formatIsraeliDateTime } from '@/lib/admin/formatDate'
import { getAdminProjectId } from '@/lib/firebase/admin'
import { PRELAUNCH_COPY, type PrelaunchLang } from '@/lib/prelaunch/copy'
import type { LeadSubmission } from '@/lib/prelaunch/validation'
import { sendToTeamInbox, type TeamInboxRow } from './teamInboxEmail'

// Tells the team inbox about a new /join lead, with Reply-To set to the lead.
// The route calls this once, for a lead it just created, after the response, so
// it can neither slow nor fail a sign-up. A failed send is logged and not
// retried: the lead itself is safe in Firestore and on /admin/prelaunch.

const NOT_ANSWERED = 'Not answered'
const LANGUAGE_NAMES: Record<PrelaunchLang, string> = { en: 'English', he: 'Hebrew', ru: 'Russian', fr: 'French', es: 'Spanish' }

export function newLeadAlertEmail(lead: LeadSubmission, leadId: string, submittedAt: Date, projectId: string) {
  const fullName = `${lead.firstName} ${lead.lastName}`
  const { personas, referralSources } = PRELAUNCH_COPY.en
  const rows: TeamInboxRow[] = [
    { label: 'Full name', value: fullName },
    { label: 'Email', value: lead.email, href: `mailto:${lead.email}` },
    { label: 'Phone', value: lead.phone, href: `tel:${lead.phone}` },
    { label: 'Preferred language', value: LANGUAGE_NAMES[lead.preferredLanguage] },
    { label: 'Persona', value: lead.persona ? personas[lead.persona] : NOT_ANSWERED },
    ...(lead.personaOtherDescription ? [{ label: 'In their words', value: lead.personaOtherDescription }] : []),
    { label: 'Heard about us', value: lead.referralSource ? referralSources[lead.referralSource] : NOT_ANSWERED },
    { label: 'Submitted', value: `${formatIsraeliDateTime(submittedAt)} (Israel)` },
    { label: 'Lead ID', value: leadId },
    // Local and Preview sign-ups reach the same inbox, so a test lead says so.
    { label: 'Project', value: projectId },
  ]
  return {
    subject: `🚀 New Waitlist Lead: ${fullName}`,
    heading: 'New waitlist lead',
    rows,
    replyName: fullName,
    source: 'the Landly waitlist form',
  }
}

/** Never throws, and logs only the lead id and a failure code: no name or address. */
export async function sendNewLeadAlertEmail(lead: LeadSubmission, leadId: string, submittedAt: Date): Promise<'sent' | 'failed'> {
  try {
    await sendToTeamInbox(
      { ...newLeadAlertEmail(lead, leadId, submittedAt, getAdminProjectId()), replyTo: lead.email },
      { idempotencyKey: `new-lead-alert/${leadId}` }
    )
    return 'sent'
  } catch (err) {
    console.error('[new-lead-alert] send failed', { leadId, code: err instanceof Error ? err.name : 'unknown' })
    return 'failed'
  }
}
