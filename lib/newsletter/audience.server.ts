import 'server-only'
import { createHash } from 'node:crypto'
import { getAdminDb } from '@/lib/firebase/admin'
import { canonicalCustomerType } from '@/lib/customerTypes'
import { LEADS_COLLECTION } from '@/lib/prelaunch/leads.server'
import { newsletterLang, NEWSLETTER_LANGS, type NewsletterLang } from './unsubscribeCopy'
import { normalizeEmail } from './unsubscribeToken'

// Who a newsletter may go to. Registered members need marketingOptIn === true
// (the sign-up checkbox); pre-launch leads are only used when the admin picks
// them (or "everyone") on purpose. Nobody who unsubscribed is ever included.
// People are deduplicated by lowercase email, and a member wins over a lead:
// the member's opt-in is live and their language is current.

export const USERS_COLLECTION = 'users'
export const SUPPRESSIONS_COLLECTION = 'newsletter_suppressions'
/** The most recipients one campaign may have. */
export const MAX_CAMPAIGN_RECIPIENTS = 3000

export const AUDIENCE_KINDS = ['users', 'leads', 'all'] as const
export type AudienceKind = (typeof AUDIENCE_KINDS)[number]

export const AUDIENCE_SEGMENTS = ['all', 'new_oleh', 'veteran_oleh', 'lone_soldier', 'student', 'local'] as const
export type AudienceSegment = (typeof AUDIENCE_SEGMENTS)[number]

export interface AudienceFilter {
  kind: AudienceKind
  segment: AudienceSegment
  lang: 'all' | NewsletterLang
}

export interface NewsletterRecipient {
  email: string
  firstName: string
  /** For the admin's subscriber list only; never used in an email. */
  lastName: string
  /** The member type or the lead's persona, as stored, for the same list. */
  segment: string
  lang: NewsletterLang
  source: 'user' | 'lead'
}

export const DEFAULT_AUDIENCE: AudienceFilter = { kind: 'users', segment: 'all', lang: 'all' }

/** A filter from untrusted input (query string or JSON body); anything unknown falls back to the default. */
export function parseAudienceFilter(input: { kind?: unknown; segment?: unknown; lang?: unknown }): AudienceFilter {
  const kind = (AUDIENCE_KINDS as readonly unknown[]).includes(input.kind) ? (input.kind as AudienceKind) : DEFAULT_AUDIENCE.kind
  const segment = (AUDIENCE_SEGMENTS as readonly unknown[]).includes(input.segment) ? (input.segment as AudienceSegment) : 'all'
  const lang = (NEWSLETTER_LANGS as readonly unknown[]).includes(input.lang) ? (input.lang as NewsletterLang) : 'all'
  return { kind, segment, lang }
}

const EMAIL_RE = /^[^\s@<>"',;:()[\]\\]+@[^\s@<>"',;:()[\]\\]+\.[^\s@<>"',;:()[\]\\.]{2,}$/

export function isDeliverableEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value.trim())
}

export function emailHash(email: string): string {
  return createHash('sha256').update(`newsletter:${normalizeEmail(email)}`).digest('hex').slice(0, 40)
}

type Doc = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

function matches(filter: AudienceFilter, segmentValue: string, lang: NewsletterLang): boolean {
  if (filter.segment !== 'all' && canonicalCustomerType(segmentValue) !== filter.segment) return false
  return filter.lang === 'all' || filter.lang === lang
}

/** What the subscriber list shows for one recipient. */
export interface SubscriberRow {
  name: string
  email: string
  source: 'user' | 'lead'
  segment: string
  lang: NewsletterLang
}

export function subscriberRows(recipients: readonly NewsletterRecipient[]): SubscriberRow[] {
  return recipients.map((r) => ({ name: `${r.firstName} ${r.lastName}`.trim(), email: r.email, source: r.source, segment: r.segment, lang: r.lang }))
}

/** Members eligible for marketing email under `filter`. Pure, for the tests. */
export function eligibleUsers(docs: Doc[], filter: AudienceFilter): NewsletterRecipient[] {
  const out: NewsletterRecipient[] = []
  for (const d of docs) {
    if (d.marketingOptIn !== true || d.unsubscribed === true || !isDeliverableEmail(d.email)) continue
    const lang = newsletterLang(d.preferredLanguage)
    if (!matches(filter, str(d.customerType), lang)) continue
    out.push({ email: normalizeEmail(d.email), firstName: str(d.firstName), lastName: str(d.lastName), segment: canonicalCustomerType(str(d.customerType)), lang, source: 'user' })
  }
  return out
}

/** Pre-launch leads that may be mailed under `filter`; `suppressed` holds emailHash()es of everyone who unsubscribed. Pure. */
export function eligibleLeads(docs: Doc[], filter: AudienceFilter, suppressed: ReadonlySet<string>): NewsletterRecipient[] {
  const out: NewsletterRecipient[] = []
  for (const d of docs) {
    if (d.unsubscribed === true || d.marketingOptIn === false || !isDeliverableEmail(d.email)) continue
    if (suppressed.has(emailHash(d.email))) continue
    const lang = newsletterLang(d.preferredLanguage ?? d.lang)
    if (!matches(filter, str(d.persona), lang)) continue
    out.push({ email: normalizeEmail(d.email), firstName: str(d.firstName), lastName: str(d.lastName), segment: canonicalCustomerType(str(d.persona)), lang, source: 'lead' })
  }
  return out
}

/** One recipient per email; the first list wins, so pass members before leads. */
export function dedupeRecipients(...lists: NewsletterRecipient[][]): NewsletterRecipient[] {
  const seen = new Set<string>()
  const out: NewsletterRecipient[] = []
  for (const list of lists) {
    for (const r of list) {
      if (seen.has(r.email)) continue
      seen.add(r.email)
      out.push(r)
    }
  }
  return out
}

async function suppressedHashes(): Promise<Set<string>> {
  const snap = await getAdminDb().collection(SUPPRESSIONS_COLLECTION).select().get()
  return new Set(snap.docs.map((doc) => doc.id))
}

export async function resolveAudience(filter: AudienceFilter): Promise<NewsletterRecipient[]> {
  const db = getAdminDb()
  const [userDocs, leadDocs, suppressed] = await Promise.all([
    filter.kind === 'leads'
      ? []
      : db
          .collection(USERS_COLLECTION)
          .where('marketingOptIn', '==', true)
          .select('email', 'firstName', 'lastName', 'preferredLanguage', 'customerType', 'unsubscribed', 'marketingOptIn')
          .get()
          .then((snap) => snap.docs.map((d) => d.data())),
    filter.kind === 'users'
      ? []
      : db
          .collection(LEADS_COLLECTION)
          .select('email', 'firstName', 'lastName', 'lang', 'preferredLanguage', 'persona', 'unsubscribed', 'marketingOptIn')
          .get()
          .then((snap) => snap.docs.map((d) => d.data())),
    filter.kind === 'users' ? new Set<string>() : suppressedHashes(),
  ])
  return dedupeRecipients(eligibleUsers(userDocs, filter), eligibleLeads(leadDocs, filter, suppressed))
}
