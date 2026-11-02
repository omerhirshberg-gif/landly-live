// What the /join sign-ups add up to, shared by the admin dashboard and
// scripts/export-prelaunch-leads.mjs so both give the same numbers and the same
// CSV. A referral is valid when it names a lead that exists and isn't the lead
// itself. The first 1,000 leads by createdAt are the Founding Members. Plain
// JavaScript and pure, so a node script can run it and the numbers are tested
// on their own.

export const FOUNDING_MEMBER_LIMIT = 1000

/** @param leads [{ id, referredBy, createdAtMs, ... }] Oldest first, each with validReferrals, foundingMember and a firstName, even if it only ever had a `name`. */
export function withReferrals(leads) {
  const ids = new Set(leads.map((lead) => lead.id))
  const referrals = new Map()
  for (const lead of leads) {
    if (lead.referredBy && lead.referredBy !== lead.id && ids.has(lead.referredBy)) {
      referrals.set(lead.referredBy, (referrals.get(lead.referredBy) ?? 0) + 1)
    }
  }
  return [...leads]
    .sort((a, b) => a.createdAtMs - b.createdAtMs || (a.id < b.id ? -1 : 1))
    .map((lead, index) => ({ ...lead, firstName: lead.firstName ?? lead.name ?? '', validReferrals: referrals.get(lead.id) ?? 0, foundingMember: index < FOUNDING_MEMBER_LIMIT }))
}

function tally(leads, read) {
  const counts = {}
  for (const lead of leads) {
    const key = read(lead) ?? '(none)'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]))
}

/** Totals with no personal data, safe to print. Compare them against the visits in Vercel Web Analytics. */
export function demandSummary(leads) {
  const ids = new Set(leads.map((lead) => lead.id))
  return {
    total: leads.length,
    referred: leads.filter((lead) => lead.referredBy && lead.referredBy !== lead.id && ids.has(lead.referredBy)).length,
    byLanguage: tally(leads, (lead) => lead.lang),
    byPersona: tally(leads, (lead) => lead.persona),
    byReferralSource: tally(leads, (lead) => lead.referralSource),
    bySource: tally(leads, (lead) => lead.attribution?.utm_source),
    byCampaign: tally(leads, (lead) => lead.attribution?.utm_campaign),
  }
}

// Visitor-typed text must not run as a spreadsheet formula. Phone numbers are
// exempt: a server-validated E.164 "+" is what broadcast tools need.
export function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

const iso = (ms) => (ms ? new Date(ms).toISOString() : '')

const CSV_COLUMNS = [
  ['firstName', (lead) => csvCell(lead.firstName)],
  ['lastName', (lead) => csvCell(lead.lastName)],
  ['phone', (lead) => lead.phone],
  ['email', (lead) => csvCell(lead.email)],
  ['lang', (lead) => lead.lang],
  ['preferredLanguage', (lead) => lead.preferredLanguage ?? lead.lang],
  ['persona', (lead) => lead.persona ?? ''],
  ['personaOtherDescription', (lead) => csvCell(lead.personaOtherDescription)],
  ['referralSource', (lead) => lead.referralSource ?? ''],
  ['foundingMember', (lead) => (lead.foundingMember ? 'yes' : 'no')],
  ['validReferrals', (lead) => lead.validReferrals],
  ['status', (lead) => csvCell(lead.status)],
  ['createdAt', (lead) => iso(lead.createdAtMs)],
  ['referralCode', (lead) => lead.id],
  ['referredBy', (lead) => csvCell(lead.referredBy)],
  ['consentVersion', (lead) => csvCell(lead.consent?.version)],
  ['consentAcceptedAt', (lead) => iso(lead.consent?.acceptedAt?.toMillis?.())],
  ['utm_source', (lead) => csvCell(lead.attribution?.utm_source)],
  ['utm_medium', (lead) => csvCell(lead.attribution?.utm_medium)],
  ['utm_campaign', (lead) => csvCell(lead.attribution?.utm_campaign)],
  ['utm_content', (lead) => csvCell(lead.attribution?.utm_content)],
  ['referrer', (lead) => csvCell(lead.attribution?.referrer)],
]

/** The leads as CSV, one per line, with the header first. Oldest first if `leads` came from withReferrals. */
export function leadsCsv(leads) {
  const header = CSV_COLUMNS.map(([name]) => name).join(',')
  const rows = leads.map((lead) => CSV_COLUMNS.map(([, read]) => read(lead)).join(','))
  return `${[header, ...rows].join('\n')}\n`
}
