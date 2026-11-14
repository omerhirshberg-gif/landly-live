import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Firestore } from 'firebase-admin/firestore'
import { TransactionStore } from '../helpers/transactionStore'

const admin = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => admin.db }))
vi.mock('next/navigation', () => ({ usePathname: () => '/join' }))
const after = vi.hoisted(() => vi.fn())
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after }))

import { POST } from '@/app/api/prelaunch/route'
import { excludesAccessibilityWidget } from '@/components/layout/AccessibilityWidget'
import { showsCookieNotice } from '@/components/layout/CookieNotice'
import LanguageSwitcher from '@/components/prelaunch/LanguageSwitcher'
import PrelaunchPage from '@/components/prelaunch/PrelaunchPage'
import { isPasskeyPromptPage } from '@/lib/auth/passkeyPrompt'
import { LOCALIZED_LANGS, normalizePersona, PERSONAS, PILLARS, PRELAUNCH_CONSENT_VERSION, PRELAUNCH_COPY, PRELAUNCH_LANGS, PRELAUNCH_PATHS, REFERRAL_SOURCES } from '@/lib/prelaunch/copy'
import { COLLAGE_PHOTOS, GALLERY_PHOTOS } from '@/lib/prelaunch/images'
import { countdownTo, LAUNCH_AT } from '@/lib/prelaunch/launch'
import { FACEBOOK_URL, httpsLink, INSTAGRAM_URL, WHATSAPP_COMMUNITY_URL } from '@/lib/prelaunch/links'
import { prelaunchLangScript } from '@/lib/prelaunch/langScript'
import { joinWaitlist, leadKeyId } from '@/lib/prelaunch/leads.server'
import { JOINED_TTL_MS, languageHref, readJoinedLead, referralLink, rememberJoinedLead, whatsappShareHref } from '@/lib/prelaunch/share'
import { cleanReferrer, parseAttribution, readArrival } from '@/lib/prelaunch/telemetry'
import { PRELAUNCH_MAX_PER_IP, reservePrelaunchAttempt } from '@/lib/prelaunch/throttle.server'
import { leadFormErrors, normalizeLeadPhone, parseLeadSubmission, type LeadSubmission } from '@/lib/prelaunch/validation'
import { csvCell, demandSummary, FOUNDING_MEMBER_LIMIT, leadsCsv, withReferrals } from '@/lib/prelaunch/demand.mjs'

const VALID = { firstName: 'Noa', lastName: 'Cohen', phone: '+972501234567', email: 'Noa@Example.com', consent: true, lang: 'he' }
const lead = (over: Partial<LeadSubmission> = {}): LeadSubmission => ({ ...parseLeadSubmission(VALID)!, ...over })
const db = (store: TransactionStore) => store.db as unknown as Firestore
const join = async (store: TransactionStore, submission: LeadSubmission) => (await joinWaitlist(db(store), submission)).leadId
const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request('https://www.golandly.com/api/prelaunch', {
    method: 'POST',
    headers: { host: 'www.golandly.com', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }))

describe('lead validation', () => {
  it('accepts a clean lead and normalizes it', () => {
    expect(parseLeadSubmission({ ...VALID, firstName: '  Noa\n ', lastName: ' Cohen\t' })).toMatchObject({ firstName: 'Noa', lastName: 'Cohen', phone: '+972501234567', email: 'noa@example.com', lang: 'he', referredBy: null })
  })
  it.each([['O\'Brien'], ['בן-דוד'], ['ג׳ורג׳'], ['Сергеев'], ['de la Cruz'], ['x'.repeat(50)]])('accepts the name %s', (lastName) => {
    expect(parseLeadSubmission({ ...VALID, lastName })?.lastName).toBe(lastName)
  })
  it('drops invisible direction marks from a name', () => {
    expect(parseLeadSubmission({ ...VALID, firstName: '\u202eNoa\u200f' })?.firstName).toBe('Noa')
  })
  it('keeps the Israeli habit of typing the leading 0', () => {
    expect(normalizeLeadPhone('+9720501234567')).toBe('+972501234567')
  })
  it.each([
    ['no name', { firstName: '  ' }],
    ['a long name', { firstName: 'x'.repeat(51) }],
    ['no last name', { lastName: '  ' }],
    ['a missing last name', { lastName: undefined }],
    ['a long last name', { lastName: 'x'.repeat(51) }],
    ['markup in a name', { firstName: '<script>alert(1)</script>' }],
    ['markup in a last name', { lastName: '<img src=x onerror=alert(1)>' }],
    ['a name of nothing but direction marks', { lastName: '\u202e\u200f' }],
    ['a bad phone', { phone: '+97250' }],
    ['a phone without a country code', { phone: '0501234567' }],
    ['a bad email', { email: 'noa@' }],
    ['no consent', { consent: false }],
    ['consent as a string', { consent: 'true' }],
    ['an unknown language', { lang: 'de' }],
  ])('refuses %s', (_, patch) => {
    expect(parseLeadSubmission({ ...VALID, ...patch })).toBeNull()
  })
  it('reports each bad field to the form', () => {
    expect(leadFormErrors({ firstName: '', lastName: '', phone: '', email: '', consent: false })).toEqual({ firstName: true, lastName: true, phone: true, email: true, consent: true })
  })
  it.each(PRELAUNCH_LANGS)('accepts a %s lead', (lang) => {
    expect(parseLeadSubmission({ ...VALID, lang })?.lang).toBe(lang)
  })
  it.each(PERSONAS)('keeps the persona %s', (persona) => {
    expect(parseLeadSubmission({ ...VALID, persona })?.persona).toBe(persona)
  })
  it('takes the preferred language, or the page language when it is missing or unknown', () => {
    expect(parseLeadSubmission({ ...VALID, preferredLanguage: 'fr' })).toMatchObject({ lang: 'he', preferredLanguage: 'fr' })
    expect(parseLeadSubmission({ ...VALID, preferredLanguage: 'de' })?.preferredLanguage).toBe('he')
    expect(parseLeadSubmission(VALID)?.preferredLanguage).toBe('he')
  })
  it('keeps the persona description only for Other, cleaned and within 120 characters', () => {
    const other = (personaOtherDescription: unknown) => parseLeadSubmission({ ...VALID, persona: 'other', personaOtherDescription })?.personaOtherDescription
    expect(other('  Here\n for <b>work\u202e ')).toBe('Here for bwork')
    expect(other('x'.repeat(200))).toHaveLength(120)
    expect(other('   ')).toBeNull()
    expect(other(7)).toBeNull()
    expect(parseLeadSubmission({ ...VALID, persona: 'student', personaOtherDescription: 'left over' })?.personaOtherDescription).toBeNull()
  })
  it.each(REFERRAL_SOURCES)('keeps the referral source %s', (referralSource) => {
    expect(parseLeadSubmission({ ...VALID, referralSource })?.referralSource).toBe(referralSource)
  })
  it('drops an unknown or missing referral source without losing the lead', () => {
    expect(parseLeadSubmission({ ...VALID, referralSource: 'admin' })?.referralSource).toBeNull()
    expect(parseLeadSubmission(VALID)?.referralSource).toBeNull()
  })
  it('reads the legacy new_immigrant persona as new_oleh', () => {
    expect(parseLeadSubmission({ ...VALID, persona: 'new_immigrant' })?.persona).toBe('new_oleh')
    expect(normalizePersona('new_immigrant')).toBe('new_oleh')
    expect(normalizePersona('veteran_oleh')).toBe('veteran_oleh')
    expect(normalizePersona('admin')).toBeNull()
  })

  it('drops an unknown or missing persona without losing the lead', () => {
    expect(parseLeadSubmission({ ...VALID, persona: 'admin' })?.persona).toBeNull()
    expect(parseLeadSubmission(VALID)?.persona).toBeNull()
  })
  it('stores each language’s own consent sentence', async () => {
    const store = new TransactionStore()
    const code = await join(store, lead({ lang: 'ru' }))
    expect(store.read(`prelaunch_leads/${code}`)?.consent.text).toBe(PRELAUNCH_COPY.ru.consent)
  })
  it('drops a malformed referral code without losing the lead', () => {
    expect(parseLeadSubmission({ ...VALID, ref: '../../users' })?.referredBy).toBeNull()
    expect(parseLeadSubmission({ ...VALID, ref: 'abcdefgh23' })?.referredBy).toBe('abcdefgh23')
  })
})

describe('attribution', () => {
  it('reads the UTM set, the ref and the referrer on arrival', () => {
    const arrival = readArrival('?utm_source=ig&utm_medium=paid&utm_campaign=drop&utm_content=reel1&ref=abc', 'https://l.instagram.com/x', new Date('2026-11-01T10:00:00Z'))
    expect(arrival.ref).toBe('abc')
    expect(arrival.attribution).toEqual({ utm_source: 'ig', utm_medium: 'paid', utm_campaign: 'drop', utm_content: 'reel1', referrer: 'https://l.instagram.com/x', clientTimestamp: '2026-11-01T10:00:00.000Z' })
  })
  it('strips the query string and refuses other schemes', () => {
    expect(cleanReferrer('https://a.com/p?email=x@y.z#f')).toBe('https://a.com/p')
    expect(cleanReferrer('javascript:alert(1)')).toBeNull()
  })
  it('bounds visitor text and survives junk', () => {
    expect(parseAttribution({ utm_source: 'x'.repeat(500) }).utm_source).toHaveLength(200)
    expect(parseAttribution({ utm_source: 5, clientTimestamp: 'soon' })).toMatchObject({ utm_source: null, clientTimestamp: null })
    expect(parseAttribution('nope').referrer).toBeNull()
  })
})

describe('joinWaitlist', () => {
  it('writes the lead, proof of consent and both keys, and nothing else', async () => {
    const store = new TransactionStore()
    const code = await join(store, lead({ referredBy: 'abcdefgh23' }))
    expect(code).toMatch(/^[a-z2-7]{10}$/)
    expect(store.read(`prelaunch_leads/${code}`)).toMatchObject({
      firstName: 'Noa', lastName: 'Cohen', phone: '+972501234567', email: 'noa@example.com', status: 'interested', referredBy: 'abcdefgh23', persona: null,
      ravMesserSync: { synced: false, syncedAt: null, error: null }, ravMesserSyncAttempts: 0,
      consent: { accepted: true, version: PRELAUNCH_CONSENT_VERSION, text: PRELAUNCH_COPY.he.consent },
    })
    expect(store.read(`prelaunch_lead_keys/${leadKeyId('phone', '+972501234567')}`)?.leadId).toBe(code)
    expect(store.read(`prelaunch_lead_keys/${leadKeyId('email', 'noa@example.com')}`)?.leadId).toBe(code)
    expect(Object.keys(store.snapshot()).filter((path) => !path.startsWith('prelaunch_'))).toEqual([])
  })
  it('stores no raw phone or email in a key id', () => {
    expect(leadKeyId('phone', '+972501234567')).toMatch(/^[0-9a-f]{64}$/)
  })
  it.each([
    ['the same phone', { email: 'other@example.com' }],
    ['the same email', { phone: '+972521234567' }],
    ['both', {}],
  ])('treats %s as the same person', async (_, over) => {
    const store = new TransactionStore()
    const first = await join(store, lead())
    const again = await join(store, lead({ ...over, firstName: 'Other', referredBy: 'abcdefgh23' }))
    expect(again).toBe(first)
    expect(store.count('prelaunch_leads')).toBe(1)
    expect(store.count('prelaunch_lead_keys')).toBe(2)
    // First touch stands.
    expect(store.read(`prelaunch_leads/${first}`)).toMatchObject({ firstName: 'Noa', referredBy: null })
  })
  it('answers with the phone’s lead when phone and email belong to different people', async () => {
    const store = new TransactionStore()
    const a = await join(store, lead())
    const b = await join(store, lead({ phone: '+972521234567', email: 'b@example.com' }))
    expect(b).not.toBe(a)
    expect(await join(store, lead({ phone: '+972501234567', email: 'b@example.com' }))).toBe(a)
    expect(store.count('prelaunch_leads')).toBe(2)
  })
  it('a racing submission that loses its commit retries into the same lead', async () => {
    const store = new TransactionStore()
    let raced = false
    store.beforeCommit = async () => {
      if (raced) return
      raced = true
      store.beforeCommit = undefined
      await join(store, lead())
    }
    const results = await join(store, lead())
    expect(store.count('prelaunch_leads')).toBe(1)
    expect(store.read(`prelaunch_leads/${results}`)).toBeTruthy()
  })
})

describe('the IP window', () => {
  it('stops at the ceiling and opens again when the window ends', async () => {
    const store = new TransactionStore()
    const now = Date.now()
    for (let i = 0; i < PRELAUNCH_MAX_PER_IP; i++) expect(await reservePrelaunchAttempt(db(store), '1.2.3.4', now)).toBe(true)
    expect(await reservePrelaunchAttempt(db(store), '1.2.3.4', now)).toBe(false)
    expect(await reservePrelaunchAttempt(db(store), '5.6.7.8', now)).toBe(true)
    expect(await reservePrelaunchAttempt(db(store), '1.2.3.4', now + 16 * 60 * 1000)).toBe(true)
  })
  it('never stores the address', async () => {
    const store = new TransactionStore()
    await reservePrelaunchAttempt(db(store), '1.2.3.4')
    expect(JSON.stringify(Object.keys(store.snapshot()))).not.toContain('1.2.3.4')
  })
})

describe('POST /api/prelaunch', () => {
  it('queues the mailing-list sync for a new lead only, after the response, and answers without waiting for it', async () => {
    admin.db = new TransactionStore().db
    after.mockClear()
    await post({ ...VALID, phone: '+972521111111', email: 'queued@example.com' })
    expect(after).toHaveBeenCalledTimes(1)
    const repeat = await post({ ...VALID, phone: '+972521111111', email: 'queued@example.com' })
    expect(repeat.status).toBe(200)
    expect(after).toHaveBeenCalledTimes(1)
  })
  it('answers a new and a repeat sign-up identically', async () => {
    const store = new TransactionStore()
    admin.db = store.db
    const first = await post(VALID)
    const second = await post({ ...VALID, firstName: 'Someone' })
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual(await first.json())
  })
  it('gives bots a fake success and writes nothing', async () => {
    const store = new TransactionStore()
    admin.db = store.db
    const response = await post({ ...VALID, website: 'spam.example' })
    expect(response.status).toBe(200)
    expect((await response.json()).referralCode).toMatch(/^[a-z2-7]{10}$/)
    expect(Object.keys(store.snapshot())).toEqual([])
  })
  it('refuses another site, junk and oversized bodies before touching Firestore', async () => {
    const store = new TransactionStore()
    admin.db = store.db
    expect((await post(VALID, { origin: 'https://evil.example' })).status).toBe(403)
    expect((await post('{nope')).status).toBe(400)
    expect((await post({ ...VALID, email: 'bad' })).status).toBe(400)
    expect((await post({ ...VALID, pad: 'x'.repeat(5000) })).status).toBe(400)
    expect(Object.keys(store.snapshot())).toEqual([])
  })
  it('allows its own origin', async () => {
    admin.db = new TransactionStore().db
    expect((await post(VALID, { origin: 'https://www.golandly.com' })).status).toBe(200)
  })
  it('answers 429 past the window', async () => {
    admin.db = new TransactionStore().db
    let last = 200
    for (let i = 0; i <= PRELAUNCH_MAX_PER_IP; i++) last = (await post(VALID)).status
    expect(last).toBe(429)
  })
  it('keeps lead details out of the log on failure', async () => {
    admin.db = { collection: () => { throw new Error('down') } }
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await post(VALID)).status).toBe(500)
    expect(JSON.stringify(log.mock.calls)).not.toContain('+972501234567')
    log.mockRestore()
  })
})

describe('sharing', () => {
  it('builds the personal link on the serving origin', () => {
    expect(referralLink('https://www.golandly.com', 'en', 'abcdefgh23')).toBe('https://www.golandly.com/join?ref=abcdefgh23')
    expect(referralLink('http://localhost:3000', 'he', 'abcdefgh23')).toBe('http://localhost:3000/join/he?ref=abcdefgh23')
    expect(referralLink('http://localhost:3000', 'ru', 'abcdefgh23')).toBe('http://localhost:3000/join/ru?ref=abcdefgh23')
  })
  it('pre-fills WhatsApp with the copy and the link', () => {
    const href = new URL(whatsappShareHref('he', 'https://x.test/join?ref=a'))
    expect(href.origin + href.pathname).toBe('https://wa.me/')
    expect(href.searchParams.get('text')).toBe(`${PRELAUNCH_COPY.he.shareText} https://x.test/join?ref=a`)
  })
  it('only ever renders an https link, falling back to the known address', () => {
    const fallback = 'https://x.test/'
    for (const value of [undefined, '', 'javascript:alert(1)', 'http://chat.whatsapp.com/x', 'not a url']) expect(httpsLink(value, fallback)).toBe(fallback)
    expect(httpsLink('https://chat.whatsapp.com/x', fallback)).toBe('https://chat.whatsapp.com/x')
  })
  it('points at the GoLandly accounts by default', () => {
    expect(INSTAGRAM_URL).toBe('https://www.instagram.com/golandly/')
    expect(FACEBOOK_URL).toBe('https://www.facebook.com/golandly/')
    expect(WHATSAPP_COMMUNITY_URL).toBe('https://chat.whatsapp.com/GC9Ais2kDVYKwRQ9rHVYKM')
  })
  it('remembers a finished sign-up across a webview reload, and forgets junk', () => {
    const data = new Map<string, string>()
    const storage = () => ({ getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) })
    rememberJoinedLead(storage, { referralCode: 'abcdefgh23', firstName: 'Noa' })
    expect(readJoinedLead(storage)).toEqual({ referralCode: 'abcdefgh23', firstName: 'Noa' })
    data.set('landly_prelaunch_joined', '{bad')
    expect(readJoinedLead(storage)).toBeNull()
    expect(readJoinedLead(() => { throw new Error('blocked') })).toBeNull()
  })
  it('forgets a finished sign-up after 30 minutes, an undated one and one from the future', () => {
    const data = new Map<string, string>()
    const storage = () => ({ getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) })
    const lead = { referralCode: 'abcdefgh23', firstName: 'Noa' }
    rememberJoinedLead(storage, lead, 1000)
    expect(readJoinedLead(storage, 1000 + JOINED_TTL_MS - 1)).toEqual(lead)
    expect(readJoinedLead(storage, 1000 + JOINED_TTL_MS)).toBeNull()
    expect(data.size).toBe(0)
    data.set('landly_prelaunch_joined', JSON.stringify(lead))
    expect(readJoinedLead(storage)).toBeNull()
    expect(data.size).toBe(0)
    rememberJoinedLead(storage, lead, 5000)
    expect(readJoinedLead(storage, 4000)).toBeNull()
  })
})

describe('the countdown', () => {
  it('targets midnight on January 1, 2027 in Israel', () => {
    expect(LAUNCH_AT.toISOString()).toBe('2026-12-31T22:00:00.000Z')
  })
  it('splits what is left into days, hours, minutes and seconds', () => {
    const left = (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000
    expect(countdownTo(LAUNCH_AT.getTime() - left)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 })
  })
  it('never shows a negative number, and ends at the launch', () => {
    expect(countdownTo(LAUNCH_AT.getTime() - 500)).toBeNull()
    expect(countdownTo(LAUNCH_AT.getTime())).toBeNull()
    expect(countdownTo(LAUNCH_AT.getTime() + 86400000)).toBeNull()
    expect(countdownTo(LAUNCH_AT.getTime() - 1000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1 })
  })
})

describe('the demand numbers', () => {
  const base = (id: string, createdAtMs: number, referredBy: string | null = null, extra = {}) => ({ id, createdAtMs, referredBy, ...extra })
  it('lists oldest first and counts valid referrals, without ranking anyone', () => {
    const leads = withReferrals([base('b', 2), base('a', 1), base('c', 3, 'b'), base('d', 4, 'b')])
    expect(leads.map((l: { id: string }) => l.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(leads[1].validReferrals).toBe(2)
  })
  it('ignores self-referrals and unknown codes', () => {
    const leads = withReferrals([base('a', 1, 'a'), base('b', 2, 'ghost')])
    expect(leads.map((l: { validReferrals: number }) => l.validReferrals)).toEqual([0, 0])
    expect(demandSummary(leads).referred).toBe(0)
  })
  it('makes the first 1,000 by createdAt the Founding Members, however they were read', () => {
    const many = Array.from({ length: FOUNDING_MEMBER_LIMIT + 2 }, (_, i) => base(`l${i}`, i + 1)).reverse()
    const leads = withReferrals(many)
    expect(leads.filter((l: { foundingMember: boolean }) => l.foundingMember)).toHaveLength(1000)
    expect(leads[999]).toMatchObject({ id: 'l999', foundingMember: true })
    expect(leads[1000]).toMatchObject({ id: 'l1000', foundingMember: false })
  })
  it('writes a CSV with every field, keeps the phone’s + and defuses visitor text', () => {
    const csv = leadsCsv(withReferrals([base('a', 1000, null, { firstName: '=cmd()', lastName: '@sum', phone: '+972501234567', email: 'a@b.co', lang: 'he', preferredLanguage: 'fr', persona: 'student', personaOtherDescription: '=evil()', referralSource: 'tiktok', attribution: { utm_source: 'ig' }, consent: { version: 'v1' } })]))
    const [header, row] = csv.trim().split('\n')
    expect(header).toBe('firstName,lastName,phone,email,lang,preferredLanguage,persona,personaOtherDescription,referralSource,foundingMember,validReferrals,status,createdAt,referralCode,referredBy,consentVersion,consentAcceptedAt,utm_source,utm_medium,utm_campaign,utm_content,referrer')
    expect(row.startsWith("'=cmd(),'@sum,+972501234567,a@b.co,he,fr,student,'=evil(),tiktok,yes,0,")).toBe(true)
    expect(row).toContain('v1')
  })
  it('leaves the last name blank for a lead from before it was asked, and reads a lead that only has a name', () => {
    const [row] = withReferrals([base('a', 1000, null, { firstName: undefined, name: 'Noa', lastName: undefined, phone: '+972501234567', email: 'a@b.co' })])
    expect(row.firstName).toBe('Noa')
    expect(leadsCsv([row]).trim().split('\n')[1].startsWith('Noa,,+972501234567,')).toBe(true)
  })
  it('totals by language, persona and campaign with no personal data', () => {
    const summary = demandSummary([
      base('a', 1, null, { lang: 'he', persona: 'student', firstName: 'Noa', phone: '+972501234567', attribution: { utm_source: 'ig', utm_campaign: 'c1' } }),
      base('b', 2, 'a', { lang: 'he', persona: null, attribution: { utm_source: 'ig', utm_campaign: 'c2' } }),
    ])
    expect(summary).toMatchObject({ total: 2, referred: 1, byLanguage: { he: 2 }, byPersona: { student: 1, '(none)': 1 }, bySource: { ig: 2 } })
    expect(JSON.stringify(summary)).not.toMatch(/Noa|972/)
  })
  it('defuses spreadsheet formulas and quotes CSV', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell(null)).toBe('')
  })
})

describe('the five languages', () => {
  const text = (value: unknown): string[] => (typeof value === 'string' ? [value] : Object.values(value as object).flatMap(text))

  it('has the same complete set of strings in every language', () => {
    const shape = (value: object): string[] => Object.entries(value).flatMap(([k, v]) => (typeof v === 'object' ? shape(v).map((c) => `${k}.${c}`) : [k])).sort()
    for (const lang of PRELAUNCH_LANGS) {
      expect(shape(PRELAUNCH_COPY[lang])).toEqual(shape(PRELAUNCH_COPY.en))
      expect(text(PRELAUNCH_COPY[lang]).every((value) => value.trim())).toBe(true)
    }
  })
  it('keeps the placeholders the page fills in', () => {
    for (const lang of PRELAUNCH_LANGS) {
      const copy = PRELAUNCH_COPY[lang]
      expect(copy.successTitle).toContain('{name}')
      expect(copy.legal).toContain('{terms}')
      expect(copy.legal).toContain('{privacy}')
    }
  })
  it.each(['GoLandly', 'WhatsApp'])('names %s in every language', (name) => {
    for (const lang of PRELAUNCH_LANGS) expect(PRELAUNCH_COPY[lang].pillarsTitle + PRELAUNCH_COPY[lang].phone).toContain(name === 'WhatsApp' && lang === 'he' ? 'וואטסאפ' : name)
  })
  it('has the agreed English and Hebrew wording', () => {
    expect(PRELAUNCH_COPY.en).toMatchObject({
      heroTitle: 'Local deals and vouchers for people new to Israel',
      heroSub: 'Free to join. Launching January 1, 2027',
      dealsBadge: 'Real local deals',
      submit: 'Reserve my spot',
      storyBody: 'GoLandly was started by two Israeli reservists who want to help newcomers find their feet and discover great local businesses.',
      foundingBody: 'The first 1,000 members get Founding Member status and first access to every new deal.',
      communityTitle: 'Join the GoLandly WhatsApp Community',
      communityBody: 'Get direct launch announcements, meet other newcomers, and get instant updates.',
    })
    expect(PRELAUNCH_COPY.he).toMatchObject({ launchDate: 'השקה רשמית: 1 בינואר 2027', dealsBadge: 'הטבות מקומיות בלעדיות', communityTitle: 'הצטרפו לקהילת הוואטסאפ של GoLandly' })
  })
  it('gives every language five FAQ items, and the same launch year', () => {
    for (const lang of PRELAUNCH_LANGS) {
      expect(PRELAUNCH_COPY[lang].faq).toHaveLength(5)
      expect(PRELAUNCH_COPY[lang].heroSub).toContain('2027')
    }
  })
  it('names both channels and the opt-out in each consent sentence (§30A)', () => {
    expect(PRELAUNCH_COPY.en.consent).toMatch(/promotional.*WhatsApp.*email.*opt out/)
    expect(PRELAUNCH_COPY.he.consent).toMatch(/פרסומי.*וואטסאפ.*אימייל.*להסיר/)
    expect(PRELAUNCH_COPY.ru.consent).toMatch(/рекламные.*WhatsApp.*email.*отказаться/)
    expect(PRELAUNCH_COPY.fr.consent).toMatch(/promotionnels.*WhatsApp.*e-mail.*désinscrire/)
    expect(PRELAUNCH_COPY.es.consent).toMatch(/promocionales.*WhatsApp.*correo.*baja/)
  })
})

describe('language routing', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nextConfig = require('../../next.config.js')

  it('serves English at /join and every other language under it', () => {
    expect(PRELAUNCH_PATHS).toEqual({ en: '/join', he: '/join/he', ru: '/join/ru', fr: '/join/fr', es: '/join/es' })
    expect(LOCALIZED_LANGS).not.toContain('en')
  })
  it('turns ?lang= into a temporary redirect, with no entry for English', async () => {
    const redirects = (await nextConfig.redirects()).filter((rule: { source: string }) => rule.source === '/join')
    expect(redirects.map((rule: { destination: string }) => rule.destination)).toEqual(LOCALIZED_LANGS.map((lang) => `/join/${lang}`))
    for (const rule of redirects) expect(rule.permanent).toBe(false)
  })
  it('builds only the known language pages, as static pages', () => {
    const source = readFileSync('app/join/[lang]/page.tsx', 'utf8')
    expect(source).toContain('export const dynamicParams = false')
    expect(source).toContain('notFound()')
  })
  it('sends a returning visitor at /join to the language they chose, keeping the query', () => {
    const location = { search: '?utm_source=ig&ref=abc', replaced: '', replace(url: string) { this.replaced = url } }
    const data = new Map([['landly_join_lang', 'ru']])
    const run = (lang: 'en' | 'he') => new Function('document', 'location', 'localStorage', prelaunchLangScript(lang))(
      { documentElement: { lang: '', dir: '', classList: { add() {}, remove() {} } } },
      location,
      { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) },
    )
    run('en')
    expect(location.replaced).toBe('/join/ru?utm_source=ig&ref=abc')
    location.replaced = ''
    run('he')
    expect(location.replaced).toBe('')
  })
  it('leaves the ad landing alone for a saved site language, and for an explicit ?lang=', () => {
    expect(prelaunchLangScript('en')).toContain("localStorage.getItem('landly_join_lang')")
    expect(prelaunchLangScript('en')).not.toContain("location.replace(localStorage.getItem('landly_lang')")
    expect(prelaunchLangScript('en')).toContain("location.search.indexOf('lang=')<0")
  })
  it('keeps the campaign query through the switcher, and drops ?lang=', () => {
    expect(languageHref('ru', '?lang=he&utm_source=ig&ref=abc')).toBe('/join/ru?utm_source=ig&ref=abc')
    expect(languageHref('en', '?lang=he')).toBe('/join')
    expect(languageHref('en', '')).toBe('/join')
    expect(readFileSync('components/prelaunch/LanguageSwitcher.tsx', 'utf8')).toContain('languageHref(next, window.location.search)')
  })
  it('offers all five languages at 16px, by name', () => {
    const html = renderToStaticMarkup(createElement(LanguageSwitcher, { lang: 'fr' }))
    for (const label of ['English', 'Русский', 'Español', 'Français', 'עברית']) expect(html).toContain(label)
    expect(html).toContain('text-base')
    expect(html).not.toMatch(/\p{Regional_Indicator}/u)
  })
  it('sets the language before paint without overwriting a saved choice', () => {
    expect(prelaunchLangScript('he')).toContain("h.dir='rtl'")
    expect(prelaunchLangScript('ru')).toContain("h.dir='ltr'")
    expect(prelaunchLangScript('he')).toContain("if(!localStorage.getItem('landly_lang'))")
  })
})

describe('the page', () => {
  const html = (lang: (typeof PRELAUNCH_LANGS)[number]) => renderToStaticMarkup(createElement(PrelaunchPage, { lang }))

  it.each(PRELAUNCH_LANGS)('server-renders in its own language and direction (%s)', (lang) => {
    expect(html(lang)).toContain(`dir="${lang === 'he' ? 'rtl' : 'ltr'}"`)
    expect(html(lang)).toContain(`lang="${lang}"`)
    expect(html(lang)).toContain(PRELAUNCH_COPY[lang].heroCta)
    expect(html(lang).match(/<h1/g)).toHaveLength(1)
  })
  it.each(PRELAUNCH_LANGS)('leads nowhere but the form, the legal pages, the GoLandly accounts and email (%s)', (lang) => {
    const hrefs = [...new Set([...html(lang).matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]))].sort()
    expect(hrefs).toEqual(['#join-form', '/privacy', '/terms', 'https://chat.whatsapp.com/GC9Ais2kDVYKwRQ9rHVYKM', 'https://www.facebook.com/golandly/', 'https://www.instagram.com/golandly/', 'mailto:contact@golandly.com'])
  })
  it.each(PRELAUNCH_LANGS)('opens every outside link safely, and names the icon links (%s)', (lang) => {
    for (const [tag] of html(lang).matchAll(/<a [^>]*target="_blank"[^>]*>/g)) expect(tag).toContain('rel="noopener noreferrer"')
    for (const name of ['Instagram', 'Facebook', 'WhatsApp']) expect(html(lang)).toContain(`aria-label="${name}"`)
  })
  it.each(PRELAUNCH_LANGS)('shows the sections, photos with alt text, and 40px badges (%s)', (lang) => {
    const page = html(lang)
    const copy = PRELAUNCH_COPY[lang]
    for (const key of PILLARS) expect(page).toContain(copy.pillars[key].title)
    for (const step of copy.steps) expect(page).toContain(step.title)
    for (const photo of [...COLLAGE_PHOTOS, ...GALLERY_PHOTOS]) expect(page).toContain(`alt="${copy.photoAlts[photo]}"`)
    expect(page).toContain(copy.foundingNumber)
    expect(page.match(/<details/g)).toHaveLength(5)
    expect(page.match(/flex h-10 w-10/g)).toHaveLength(6)
    expect(page).toContain('stroke-width="1.75"')
  })
  it.each(PRELAUNCH_LANGS)('shows the social accounts large, in words, in the page body (%s)', (lang) => {
    const page = html(lang)
    const copy = PRELAUNCH_COPY[lang]
    const body = page.slice(0, page.indexOf('<footer'))
    expect(page.indexOf(copy.followTitle)).toBeLessThan(page.indexOf(copy.pillarsTitle))
    expect(page.indexOf(copy.followTitle)).toBeGreaterThan(page.indexOf(copy.photoAlts.kids))
    for (const [href, label] of [[INSTAGRAM_URL, copy.followLabels.instagram], [FACEBOOK_URL, copy.followLabels.facebook], [WHATSAPP_COMMUNITY_URL, copy.followLabels.whatsapp]]) {
      const link = body.match(new RegExp(`<a [^>]*href="${href}"[^>]*>[\\s\\S]*?</a>`))![0]
      expect(link).toContain(label)
      expect(link).toContain(copy.newTab)
      expect(link).toContain('min-h-[88px]')
      expect(link).toContain('rel="noopener noreferrer"')
      expect(link).toContain('focus-visible:ring-4')
    }
  })
  it('renders the countdown as placeholders on the server and the date for screen readers', () => {
    expect(html('he')).toContain('--')
    expect(html('he')).toContain(PRELAUNCH_COPY.he.launchDate)
  })
  it.each(PRELAUNCH_LANGS)('leaves consent unticked, the persona optional, and a honeypot hidden (%s)', (lang) => {
    const box = html(lang).match(/<input[^>]*type="checkbox"[^>]*>/)![0]
    expect(box).not.toContain('checked')
    expect(html(lang)).toContain('name="website"')
    const select = html(lang).match(/<select[^>]*name="persona"[\s\S]*?<\/select>/)![0]
    expect(select).not.toContain('required')
    expect(select.match(/<option/g)).toHaveLength(PERSONAS.length + 1)
    expect(select).toContain('text-base')
  })
  it('keeps the phone left to right in Hebrew, at 16px type', () => {
    expect(html('he')).toMatch(/<div dir="ltr" class="join-phone/)
    expect(readFileSync('app/globals.css', 'utf8')).toMatch(/\.PhoneInputInput\{[^}]*font-size:16px/)
    expect(readFileSync('components/prelaunch/LeadForm.tsx', 'utf8')).toContain('text-base')
  })
  it('is noindex, static and absent from the sitemap', () => {
    expect(readFileSync('app/join/layout.tsx', 'utf8')).toContain('index: false')
    expect(readFileSync('app/sitemap.ts', 'utf8')).not.toContain('/join')
    expect(readFileSync('app/robots.ts', 'utf8')).not.toContain('/join')
    expect(readFileSync('components/prelaunch/PrelaunchPage.tsx', 'utf8')).not.toContain('useSearchParams')
  })
  it('counts visits on /join alone, and adds no ad pixel', () => {
    expect(readFileSync('app/join/layout.tsx', 'utf8')).toContain("from '@vercel/analytics/next'")
    expect(readFileSync('app/layout.tsx', 'utf8')).not.toContain('@vercel/analytics')
    expect(readFileSync('app/join/layout.tsx', 'utf8')).not.toMatch(/fbq|ttq|gtag/)
  })
})

describe('the root layout widgets on /join', () => {
  it.each(['/join', ...LOCALIZED_LANGS.map((lang) => `/join/${lang}`)])('cookie notice and passkey prompt stay off %s; accessibility stays on', (path) => {
    expect(showsCookieNotice(path)).toBe(false)
    expect(isPasskeyPromptPage(path)).toBe(false)
    expect(excludesAccessibilityWidget(path)).toBe(false)
  })
  it('leaves the rest of the site alone', () => {
    for (const path of ['/', '/joinery', '/offers/a']) {
      expect(showsCookieNotice(path)).toBe(true)
      expect(isPasskeyPromptPage(path)).toBe(true)
    }
  })
})
