import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const m = vi.hoisted(() => ({
  authError: null as Response | null,
  recipients: [] as { email: string; firstName: string; lastName?: string; segment?: string; lang: string; source: string }[],
  mode: 'simulated' as 'live' | 'simulated',
  inFlight: false,
  created: [] as unknown[],
  ran: [] as unknown[],
  applied: [] as string[],
  limited: false,
  testSend: vi.fn(),
  usage: vi.fn(),
}))

vi.mock('@/lib/admin/adminAuth', () => ({ requireAdminAuth: () => m.authError }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminProjectId: () => 'landly-dev' }))
vi.mock('@/lib/auth/requestContext', () => ({ applicationOrigin: () => 'https://golandly.com' }))
vi.mock('@/lib/auth/clientIp', () => ({ clientIp: () => '1.2.3.4' }))
vi.mock('@/lib/auth/durableRateLimit.server', () => ({ isDurablyLimited: async () => m.limited }))
vi.mock('@/lib/usage/recordUsage', () => ({ recordUsage: m.usage, recordUsageBatch: m.usage }))
vi.mock('@/lib/newsletter/audience.server', async (orig) => ({ ...(await orig<typeof import('@/lib/newsletter/audience.server')>()), resolveAudience: async () => m.recipients }))
vi.mock('@/lib/newsletter/campaigns.server', () => ({
  campaignSendMode: () => m.mode,
  hasCampaignInFlight: async () => m.inFlight,
  createCampaign: async (p: unknown) => (m.created.push(p), 'camp1'),
  runAfterResponse: (task: () => Promise<void>) => void task(),
  runCampaign: async (p: unknown) => void m.ran.push(p),
  listCampaigns: async () => [{ id: 'c1', subject: 'S' }],
}))
vi.mock('@/lib/newsletter/applyUnsubscribe.server', () => ({ applyUnsubscribe: async (e: string) => void m.applied.push(e) }))
vi.mock('@/lib/email/newsletterEmail', async (orig) => ({ ...(await orig<typeof import('@/lib/email/newsletterEmail')>()), sendNewsletterTest: m.testSend }))

import { GET as audienceGet } from '@/app/api/admin/newsletter/audience/route'
import { GET as campaignsGet } from '@/app/api/admin/newsletter/campaigns/route'
import { POST as previewPost } from '@/app/api/admin/newsletter/preview/route'
import { POST as sendPost } from '@/app/api/admin/newsletter/send/route'
import { POST as testPost } from '@/app/api/admin/newsletter/test/route'
import { GET as unsubGet, POST as unsubPost } from '@/app/api/newsletter/unsubscribe/route'
import { EmailProviderError } from '@/lib/email/brandedEmail'
import { createUnsubscribeToken } from '@/lib/newsletter/unsubscribeToken'

const body = { subject: 'S', headline: 'H', body: 'B', ctaLabel: '', ctaUrl: '' }
const post = (url: string, json: unknown) => new Request(`https://golandly.com${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) })
const people = (n: number) => Array.from({ length: n }, (_, i) => ({ email: `u${i}@x.co`, firstName: '', lang: 'en', source: 'user' }))

beforeEach(() => {
  process.env.UNSUBSCRIBE_SECRET = 'secret'
  Object.assign(m, { authError: null, recipients: [], mode: 'simulated', inFlight: false, created: [], ran: [], applied: [], limited: false })
  m.testSend.mockReset()
  m.usage.mockReset()
  delete process.env.RESEND_API_KEY
})

describe('admin newsletter routes', () => {
  it('require the admin session', async () => {
    m.authError = NextResponse.json({ error: 'no' }, { status: 401 })
    for (const res of [
      await audienceGet(new Request('https://golandly.com/api/admin/newsletter/audience')),
      await campaignsGet(new Request('https://golandly.com/api/admin/newsletter/campaigns')),
      await previewPost(post('/p', body)),
      await testPost(post('/t', { ...body, to: 'a@b.co' })),
      await sendPost(post('/s', body)),
    ])
      expect(res.status).toBe(401)
    expect(m.created).toEqual([])
  })

  it('counts the audience with the cap and mode', async () => {
    m.recipients = people(3001)
    const res = await audienceGet(new Request('https://golandly.com/api/admin/newsletter/audience?kind=all'))
    expect(await res.json()).toMatchObject({ filter: { kind: 'all' }, count: 3001, cap: 3000, overCap: true, mode: 'simulated' })
  })

  it('lists the matching people only when asked, with the environment', async () => {
    m.recipients = [{ email: 'a@x.co', firstName: 'Dana', lastName: 'Levi', lang: 'he', source: 'user', segment: 'student' }]
    const plain = await (await audienceGet(new Request('https://golandly.com/api/admin/newsletter/audience'))).json()
    expect(plain.list).toBeUndefined()
    const listed = await (await audienceGet(new Request('https://golandly.com/api/admin/newsletter/audience?includeList=true'))).json()
    expect(listed.env).toBe('dev')
    expect(listed.list).toEqual([{ name: 'Dana Levi', email: 'a@x.co', source: 'user', segment: 'student', lang: 'he' }])
  })

  it('previews with the real template and never needs complete input', async () => {
    const res = await previewPost(post('/p', { body: 'Hello {firstName}', ctaUrl: 'javascript:alert(1)', ctaLabel: 'x', lang: 'fr' }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.html).toContain('<bdi dir="auto">Dana</bdi>')
    expect(data.html).not.toContain('javascript:')
    expect(data.html).toContain('Se désabonner')
  })

  describe('test send', () => {
    it('validates content and address', async () => {
      expect((await testPost(post('/t', { ...body, subject: '', to: 'a@b.co' }))).status).toBe(400)
      expect(await (await testPost(post('/t', { ...body, to: 'nope' }))).json()).toEqual({ error: 'test_email_invalid' })
    })
    it('simulates without a Resend key', async () => {
      expect(await (await testPost(post('/t', { ...body, to: 'a@b.co' }))).json()).toEqual({ ok: true, simulated: true })
      expect(m.testSend).not.toHaveBeenCalled()
    })
    it('sends one email and counts it; surfaces provider errors', async () => {
      process.env.RESEND_API_KEY = 're_x'
      expect(await (await testPost(post('/t', { ...body, to: 'A@B.co' }))).json()).toEqual({ ok: true, simulated: false })
      expect(m.testSend.mock.calls[0]![0]).toMatchObject({ to: 'a@b.co' })
      m.testSend.mockRejectedValueOnce(new EmailProviderError('validation_error', 403, 'domain not verified'))
      const res = await testPost(post('/t', { ...body, to: 'a@b.co' }))
      expect(res.status).toBe(502)
      expect(await res.json()).toMatchObject({ error: 'provider_error', message: expect.stringContaining('domain not verified') })
    })
  })

  describe('send', () => {
    const send = (extra: object = {}) => sendPost(post('/s', { ...body, audience: { kind: 'users' }, expectedCount: 2, ...extra }))
    it('refuses empty, over-cap, stale-count and concurrent campaigns', async () => {
      expect((await send()).status).toBe(400)
      m.recipients = people(3001)
      expect(await (await send({ expectedCount: 3001 })).json()).toEqual({ error: 'audience_over_cap' })
      m.recipients = people(2)
      const stale = await send({ expectedCount: 5 })
      expect(stale.status).toBe(409)
      expect(await stale.json()).toEqual({ error: 'audience_changed', count: 2 })
      m.inFlight = true
      expect(await (await send()).json()).toEqual({ error: 'campaign_in_flight' })
      expect(m.created).toEqual([])
    })
    it('starts a campaign and runs it after responding', async () => {
      m.recipients = people(2)
      const res = await send()
      expect(res.status).toBe(202)
      expect(await res.json()).toEqual({ ok: true, campaignId: 'camp1', recipientCount: 2, simulated: true })
      expect(m.ran[0]).toMatchObject({ campaignId: 'camp1', mode: 'simulated', origin: 'https://golandly.com' })
    })
  })
})

describe('/api/newsletter/unsubscribe', () => {
  const url = (token: string) => `https://golandly.com/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`

  it('GET never unsubscribes; it redirects to the confirmation page', async () => {
    const token = createUnsubscribeToken('a@b.co')
    const res = await unsubGet(new Request(url(token)))
    expect(res.status).toBe(303)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/unsubscribe')
    expect(m.applied).toEqual([])
  })
  it('POST one-click (token in the URL) opts the address out', async () => {
    const res = await unsubPost(new Request(url(createUnsubscribeToken('A@B.co')), { method: 'POST', body: 'List-Unsubscribe=One-Click', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }))
    expect(res.status).toBe(200)
    expect(m.applied).toEqual(['a@b.co'])
  })
  it('POST from the page (token in JSON)', async () => {
    const res = await unsubPost(post('/api/newsletter/unsubscribe', { token: createUnsubscribeToken('c@d.co') }))
    expect(res.status).toBe(200)
    expect(m.applied).toEqual(['c@d.co'])
  })
  it('rejects forged tokens and honors the rate limit', async () => {
    expect((await unsubPost(new Request(url('abc.def'), { method: 'POST' }))).status).toBe(400)
    m.limited = true
    expect((await unsubPost(new Request(url(createUnsubscribeToken('a@b.co')), { method: 'POST' }))).status).toBe(429)
    expect(m.applied).toEqual([])
  })
})
