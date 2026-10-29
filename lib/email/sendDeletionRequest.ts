import 'server-only'
import { buildTeamInboxEmail, sendToTeamInbox } from './teamInboxEmail'
import { multiLine, singleLine } from './formFields'
import { isAppleRevocation, type AppleRevocation } from '@/lib/account/appleRevocation'
import { DELETION_DETAILS_MAX, isDeletionReason, type DeletionReason } from '@/lib/account/deletionReasons'

// The account-deletion request (web /settings, app Profile tab), delivered to
// the team inbox (teamInboxEmail.ts) with Reply-To set to the member. Only the
// optional reason, details and site language come from the request body; who
// is asking (UID, name, email) is filled in by the route from the verified ID
// token and users/{uid}. For an Apple account, the body also says what
// happened to its Sign in with Apple tokens (lib/account/appleRevocation.ts),
// as reported by the member's device: a note for the team, never trusted for
// anything else.

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
  /** null when the form didn't run the Apple step (not an Apple account, or an older app). */
  appleRevocation: AppleRevocation | null
}

const APPLE_REVOCATION_LABELS: Record<AppleRevocation, string> = {
  revoked: 'Revoked (the member confirmed with Apple)',
  failed: 'NOT revoked: confirming with Apple or revoking failed',
  unavailable: "NOT revoked: Apple confirmation isn't available on this device (the member was told how to remove Landly in their Apple ID settings)",
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
  let appleRevocation: AppleRevocation | null = null
  if (raw.appleRevocation !== undefined && raw.appleRevocation !== null) {
    if (!isAppleRevocation(raw.appleRevocation)) return null
    appleRevocation = raw.appleRevocation
  }
  return { reason, details, lang, appleRevocation }
}

export interface DeletionRequestEmail extends DeletionRequestBody {
  uid: string
  name: string
  email: string
  /** Firebase sign-in providers, e.g. ["password"], ["google.com"] or ["apple.com"]. */
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
      ...(req.providers.includes('apple.com') || req.appleRevocation
        ? [{ label: 'Apple tokens', value: req.appleRevocation ? APPLE_REVOCATION_LABELS[req.appleRevocation] : 'NOT revoked: not attempted (an older version of the app)' }]
        : []),
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
