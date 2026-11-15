import { describe, expect, it } from 'vitest'
import { dedupeRecipients, eligibleLeads, eligibleUsers, emailHash, isDeliverableEmail, parseAudienceFilter, type AudienceFilter } from '@/lib/newsletter/audience.server'

const ALL: AudienceFilter = { kind: 'all', segment: 'all', lang: 'all' }

describe('newsletter audience', () => {
  it('only members who opted in, did not unsubscribe and have a valid email', () => {
    const users = eligibleUsers(
      [
        { email: 'A@x.co', marketingOptIn: true, firstName: ' Dana ', preferredLanguage: 'he' },
        { email: 'b@x.co', marketingOptIn: false },
        { email: 'c@x.co', marketingOptIn: true, unsubscribed: true },
        { email: 'not-an-email', marketingOptIn: true },
        { marketingOptIn: true },
        { email: 'd@x.co', marketingOptIn: 'true' },
      ],
      ALL
    )
    expect(users).toEqual([{ email: 'a@x.co', firstName: 'Dana', lastName: '', segment: '', lang: 'he', source: 'user' }])
  })

  it('filters members by type (legacy values included) and language', () => {
    const docs = [
      { email: 'a@x.co', marketingOptIn: true, customerType: 'new_immigrant', preferredLanguage: 'en' },
      { email: 'b@x.co', marketingOptIn: true, customerType: 'student', preferredLanguage: 'en' },
      { email: 'c@x.co', marketingOptIn: true, customerType: 'new_oleh', preferredLanguage: 'he' },
    ]
    expect(eligibleUsers(docs, { kind: 'users', segment: 'new_oleh', lang: 'all' }).map((r) => r.email)).toEqual(['a@x.co', 'c@x.co'])
    expect(eligibleUsers(docs, { kind: 'users', segment: 'new_oleh', lang: 'he' }).map((r) => r.email)).toEqual(['c@x.co'])
  })

  it('leads: skips unsubscribed, opted-out and suppressed ones', () => {
    const suppressed = new Set([emailHash('gone@x.co')])
    const leads = eligibleLeads(
      [
        { email: 'ok@x.co', persona: 'student', lang: 'ru' },
        { email: 'u@x.co', unsubscribed: true },
        { email: 'o@x.co', marketingOptIn: false },
        { email: 'Gone@x.co' },
      ],
      ALL,
      suppressed
    )
    expect(leads).toEqual([{ email: 'ok@x.co', firstName: '', lastName: '', segment: 'student', lang: 'ru', source: 'lead' }])
  })

  it('dedupes by lowercase email with members first', () => {
    const merged = dedupeRecipients(
      [{ email: 'a@x.co', firstName: 'User', lastName: '', segment: '', lang: 'en', source: 'user' }],
      [
        { email: 'a@x.co', firstName: 'Lead', lastName: '', segment: '', lang: 'he', source: 'lead' },
        { email: 'b@x.co', firstName: '', lastName: '', segment: '', lang: 'en', source: 'lead' },
      ]
    )
    expect(merged.map((r) => [r.email, r.source])).toEqual([['a@x.co', 'user'], ['b@x.co', 'lead']])
  })

  it('parses untrusted filters, falling back to members-only', () => {
    expect(parseAudienceFilter({})).toEqual({ kind: 'users', segment: 'all', lang: 'all' })
    expect(parseAudienceFilter({ kind: 'all', segment: 'student', lang: 'fr' })).toEqual({ kind: 'all', segment: 'student', lang: 'fr' })
    expect(parseAudienceFilter({ kind: 'everyone', segment: 'x', lang: 'de' })).toEqual({ kind: 'users', segment: 'all', lang: 'all' })
  })

  it('checks email shape', () => {
    expect(isDeliverableEmail('a@b.co')).toBe(true)
    for (const bad of ['a@b', 'a b@c.co', '@c.co', 'a@@c.co', '', 5, 'a@b.c']) expect(isDeliverableEmail(bad)).toBe(false)
  })
})
