import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const admin = vi.hoisted(() => ({ docs: [] as { id: string; data: () => unknown }[], fail: false }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminProjectId: () => 'landly-dev',
  getAdminDb: () => ({
    collection: (name: string) => {
      if (name !== 'prelaunch_leads') throw new Error(`unexpected collection ${name}`)
      return { get: async () => { if (admin.fail) throw new Error('down'); return { docs: admin.docs } } }
    },
  }),
}))

import { GET } from '@/app/api/admin/prelaunch/route'
import { issueAdminSessionToken } from '@/lib/admin/sessionToken'
import { ADMIN_ROUTES } from '@/lib/admin/routes'
import { filterLeads, parseLeadFilters, prelaunchStats, type AdminLead } from '@/lib/admin/prelaunchStats'

const row = (over: Partial<AdminLead>): AdminLead => ({
  id: 'abcdefgh23', firstName: 'Noa', phone: '+972501234567', email: 'noa@example.com', lang: 'he', persona: null,
  createdAt: null, referredBy: null, validReferrals: 0, foundingMember: true, utmSource: null, utmCampaign: null, ...over,
})
const stored = (id: string, ms: number, over: object = {}) => ({
  id,
  data: () => ({ firstName: id, phone: '+972501234567', email: `${id}@example.com`, lang: 'en', persona: 'student', status: 'interested', referredBy: null, createdAt: { toMillis: () => ms }, attribution: { utm_source: 'ig', utm_campaign: 'c1' }, ...over }),
})
const request = (query = '', headers: Record<string, string> = {}) => new Request(`https://www.golandly.com/api/admin/prelaunch${query}`, { headers })
const signedIn = () => ({ authorization: `Bearer ${issueAdminSessionToken()}` })

beforeEach(() => {
  vi.stubEnv('ADMIN_SESSION_SECRET', 'x'.repeat(48))
  admin.docs = []
  admin.fail = false
})

describe('GET /api/admin/prelaunch', () => {
  it.each(['', '?format=csv'])('refuses a request with no session (%s)', async (query) => {
    admin.docs = [stored('a', 1)]
    const response = await GET(request(query))
    expect(response.status).toBe(401)
    expect(await response.text()).not.toContain('a@example.com')
  })
  it('refuses a forged session', async () => {
    expect((await GET(request('', { authorization: 'Bearer forged.token' }))).status).toBe(401)
  })
  it('gives the rows newest first with their totals, uncached', async () => {
    admin.docs = [stored('a', 1000), stored('b', 2000, { referredBy: 'a', lang: 'he', persona: null })]
    const response = await GET(request('', signedIn()))
    const body = await response.json()
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(body.projectId).toBe('landly-dev')
    expect(body.leads.map((lead: AdminLead) => lead.id)).toEqual(['b', 'a'])
    expect(body.leads[1]).toMatchObject({ validReferrals: 1, foundingMember: true, utmSource: 'ig', utmCampaign: 'c1', createdAt: '1970-01-01T00:00:01.000Z' })
    expect(body.stats).toMatchObject({ total: 2, byLang: { en: 1, he: 1 }, byPersona: { student: 1, none: 1 }, topReferrers: [{ id: 'a', firstName: 'a', count: 1 }] })
  })
  it('downloads a CSV honoring the filters, uncached, readable by Excel', async () => {
    admin.docs = [stored('a', 1000), stored('b', 2000, { lang: 'he' })]
    const response = await GET(request('?format=csv&lang=he', signedIn()))
    expect(response.headers.get('Content-Type')).toContain('text/csv')
    expect(response.headers.get('Content-Disposition')).toMatch(/^attachment; filename="landly-prelaunch-leads-\d{4}-\d{2}-\d{2}\.csv"$/)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const bytes = new Uint8Array(await response.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('b@example.com')
    expect(text).not.toContain('a@example.com')
  })
  it('answers 502 with no lead details in the log when Firestore fails', async () => {
    admin.fail = true
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await GET(request('', signedIn()))).status).toBe(502)
    log.mockRestore()
  })
})

describe('the lead filters', () => {
  const leads = [
    row({ id: 'a', firstName: 'Noa', email: 'noa@example.com', phone: '+972501234567', lang: 'he', persona: 'student' }),
    row({ id: 'b', firstName: 'Сергей', email: 'serg@mail.ru', phone: '+15551234567', lang: 'ru', persona: null }),
  ]
  const ids = (filters: Partial<Parameters<typeof filterLeads>[1]>) => filterLeads(leads, { query: '', lang: null, persona: null, ...filters }).map((lead) => lead.id)

  it.each([
    ['a name in any case', 'NOA', ['a']],
    ['a Cyrillic name', 'серг', ['b']],
    ['an email', 'mail.ru', ['b']],
    ['a full phone', '+972501234567', ['a']],
    ['a local phone with spaces', '050 123 4567', ['a']],
    ['nothing that matches', 'zzz', []],
  ])('finds %s', (_, query, expected) => {
    expect(ids({ query })).toEqual(expected)
  })
  it('filters by language and persona, including no answer', () => {
    expect(ids({ lang: 'ru' })).toEqual(['b'])
    expect(ids({ persona: 'student' })).toEqual(['a'])
    expect(ids({ persona: 'none' })).toEqual(['b'])
    expect(ids({ lang: 'he', persona: 'none' })).toEqual([])
  })
  it('treats an unknown filter in a URL as no filter', () => {
    expect(parseLeadFilters(new URLSearchParams('lang=de&persona=admin&q=x'))).toEqual({ query: 'x', lang: null, persona: null })
    expect(parseLeadFilters(new URLSearchParams('lang=fr&persona=none'))).toEqual({ query: '', lang: 'fr', persona: 'none' })
  })
})

describe('the totals', () => {
  it('counts every language and persona, and ranks referrers', () => {
    const stats = prelaunchStats([
      row({ id: 'a', firstName: 'A', validReferrals: 1, persona: 'local' }),
      row({ id: 'b', firstName: 'B', validReferrals: 3, lang: 'es', foundingMember: false }),
    ])
    expect(stats).toMatchObject({ total: 2, foundingMembers: 1, byLang: { he: 1, es: 1, en: 0, ru: 0, fr: 0 }, byPersona: { local: 1, none: 1, student: 0 } })
    expect(stats.topReferrers.map((referrer) => referrer.id)).toEqual(['b', 'a'])
  })
  it('stops at five referrers', () => {
    const leads = Array.from({ length: 7 }, (_, i) => row({ id: `l${i}`, validReferrals: i + 1 }))
    expect(prelaunchStats(leads).topReferrers).toHaveLength(5)
  })
})

describe('the page', () => {
  it('is in the admin navigation and has its title', () => {
    expect(ADMIN_ROUTES.find((route) => route.pattern === '/admin/prelaunch')?.title).toBe('Pre-Launch Leads')
    expect(readFileSync('components/admin/Sidebar.tsx', 'utf8')).toContain("href: '/admin/prelaunch'")
  })
})
