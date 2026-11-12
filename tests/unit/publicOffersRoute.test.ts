import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  revalidateTag: vi.fn(),
  docs: [] as { id: string; data: () => Record<string, unknown> }[],
}))
vi.mock('server-only', () => ({}))
// unstable_cache needs a Next request context; here it just runs the function.
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn, revalidateTag: mocks.revalidateTag, revalidatePath: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: () => ({ collection: () => ({ limit: (n: number) => { mocks.limit(n); return { get: async () => ({ docs: mocks.docs }) } } }) }),
}))

const stamp = (ms: number) => ({ toDate: () => new Date(ms) })
const doc = (id: string, data: Record<string, unknown> = {}) => ({ id, data: () => ({ title: id, ...data }) })
const get = (headers: Record<string, string> = {}) => new Request('https://landly.test/api/public/offers', { headers })

beforeEach(() => {
  vi.resetModules()
  mocks.limit.mockClear()
  mocks.revalidateTag.mockClear()
  mocks.docs = []
})

describe('GET /api/public/offers', () => {
  it('reads at most 500 offers with the Admin SDK and returns them cacheable for the CDN', async () => {
    mocks.docs = [doc('a', { createdAt: stamp(1000) }), doc('b')]
    const { GET } = await import('@/app/api/public/offers/route')
    const res = await GET(get())
    expect(mocks.limit).toHaveBeenCalledWith(500)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=300')
    const body = await res.json()
    expect(body.offers.map((o: { id: string }) => o.id)).toEqual(['a', 'b'])
    // Dates travel as ISO strings.
    expect(body.offers[0].createdAt).toBe(new Date(1000).toISOString())
  })

  it('leaves out expired offers so they are never sent', async () => {
    mocks.docs = [doc('live', { expiryDate: stamp(Date.now() + 86_400_000) }), doc('old', { expiryDate: stamp(Date.now() - 86_400_000) })]
    const { GET } = await import('@/app/api/public/offers/route')
    expect((await (await GET(get())).json()).offers.map((o: { id: string }) => o.id)).toEqual(['live'])
  })

  it('carries no member data: every field is one the public offer page already shows', async () => {
    mocks.docs = [doc('a', { poolId: 'p1', businessId: 'b1', secretNote: 'x' })]
    const { GET } = await import('@/app/api/public/offers/route')
    const offer = (await (await GET(get())).json()).offers[0]
    expect(offer).not.toHaveProperty('secretNote')
  })

  it('answers an allowed origin with CORS (Expo web) and Vary: Origin, and a stranger without', async () => {
    const { GET, OPTIONS } = await import('@/app/api/public/offers/route')
    const ok = await GET(get({ origin: 'http://localhost:8081' }))
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8081')
    expect(ok.headers.get('Vary')).toBe('Origin')
    const stranger = await GET(get({ origin: 'https://evil.example' }))
    expect(stranger.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(OPTIONS(get({ origin: 'http://localhost:8081' })).status).toBe(204)
  })

  it('fails with 503 and no-store, so a failure is never cached', async () => {
    vi.doMock('@/lib/firebase/admin', () => ({ getAdminDb: () => { throw new Error('no credentials') } }))
    const { GET } = await import('@/app/api/public/offers/route')
    const res = await GET(get())
    expect(res.status).toBe(503)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    vi.doUnmock('@/lib/firebase/admin')
  })
})

describe('on-demand revalidation', () => {
  it('every admin write that refreshes the guest home also drops the cached offers, immediately', async () => {
    const { revalidateGuestHome } = await import('@/lib/admin/revalidateHome')
    revalidateGuestHome()
    expect(mocks.revalidateTag).toHaveBeenCalledWith('public-offers', { expire: 0 })
  })

  it('never throws when there is no Next cache to drop', async () => {
    mocks.revalidateTag.mockImplementation(() => { throw new Error('static generation store missing') })
    const { revalidatePublicOffers } = await import('@/lib/firebase/offersCache.server')
    expect(() => revalidatePublicOffers()).not.toThrow()
  })
})
