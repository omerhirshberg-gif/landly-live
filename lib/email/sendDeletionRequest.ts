import 'server-only'
import { buildTeamInboxEmail, sendToTeamInbox } from './teamInboxEmail'
import { multiLine, singleLine } from './formFields'
import { DELETION_DETAILS_MAX, isDeletionReason, type DeletionReason } from '@/lib/account/deletionReasons'

// The account-deletion request (web /settings, app Profile tab), delivered to
// the team inbox (teamInboxEmail.ts) with Reply-To set to the member. Only the
// optional reason, details and site language come from the request body; who
// is asking (UID, name, email) is filled in by the route from the verified ID
// token and users/{uid}.

const REASON_LABELS: Record<DeletionReason, string> = {
  not_using: "Doesn't use Landly anymore",
  missing_perks: 'Not enough perks',
  privacy: 'Privacy concerns',
  moving: 'Leaving Israel',
  other: 'Other',
}

export interface DeletionRequestBody {
  reason: DeletionReason | null
  details: string
  lang: string
}

/** Cleans the raw request body, or returns null unless it confirms and every field is valid. */
export function parseDeletionRequest(body: unknown): DeletionRequestBody | null {
  if (!body || typeof body !== 'object') return null
  const raw = body as Record<string, unknown>
  if (raw.confirm !== true) return null
  let reason: DeletionReason | null = null
  if (raw.reason !== undefined && raw.reason !== null && raw.reason !== '') {
    if (!isDeletionReason(raw.reason)) return null
    reason = raw.reason
  }
  if (raw.details !== undefined && typeof raw.details !== 'string') return null
  const details = typeof raw.details === 'string' ? multiLine(raw.details) : ''
  if (details.length > DELETION_DETAILS_MAX) return null
  const lang = typeof raw.lang === 'string' ? singleLine(raw.lang).slice(0, 8) : ''
  return { reason, details, lang }
}

export interface DeletionRequestEmail extends DeletionRequestBody {
  uid: string
  name: string
  email: string
  /** Firebase sign-in providers, e.g. ["password"] or ["google.com"]. */
  providers: string[]
  requestedAt: Date
}

function israelTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function deletionEmail(req: DeletionRequestEmail) {
  const name = singleLine(req.name)
  const email = singleLine(req.email)
  return {
    subject: `[Landly Account Deletion Request] ${name} (${email})`,
    heading: 'Account deletion request',
    rows: [
      { label: 'UID', value: req.uid },
      { label: 'Full name', value: name },
      { label: 'Email', value: email, href: `mailto:${email}` },
      { label: 'Sign-in', value: req.providers.join(', ') || 'unknown' },
      { label: 'Site language', value: req.lang || 'unknown' },
      { label: 'Requested at', value: `${req.requestedAt.toISOString()} (Israel: ${israelTime(req.requestedAt)})` },
      { label: 'Reason', value: req.reason ? REASON_LABELS[req.reason] : 'Not given' },
    ],
    message: req.details || '(no details given)',
    replyName: name,
    source: 'the Landly account deletion form',
  }
}

export function buildDeletionRequestEmail(req: DeletionRequestEmail) {
  return buildTeamInboxEmail(deletionEmail(req))
}

export async function sendDeletionRequest(req: DeletionRequestEmail): Promise<void> {
  await sendToTeamInbox({ ...deletionEmail(req), replyTo: singleLine(req.email) })
}
