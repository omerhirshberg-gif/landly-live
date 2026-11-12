import { beforeEach, describe, expect, it, vi } from 'vitest'

// The client SDK and its config are replaced: nothing here touches Firebase.
const fs = vi.hoisted(() => ({
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  query: vi.fn((...parts: unknown[]) => ({ parts })),
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  where: vi.fn((...parts: unknown[]) => ({ where: parts })),
  limit: vi.fn((n: number) => ({ limit: n })),
  documentId: vi.fn(() => '__name__'),
  doc: vi.fn(),
}))
vi.mock('firebase/firestore', () => fs)
vi.mock('@/lib/firebase/config', () => ({ db: {} }))

const day = 24 * 60 * 60 * 1000
const stamp = (ms: number) => ({ toDate: () => new Date(ms) })
const snap = (docs: { id: string; data: Record<string, unknown> }[]) => ({ docs: docs.map((d) => ({ id: d.id, data: () => d.data })) })
const wire = (id: string, extra: Record<string, unknown> = {}) => ({
  id, title: id, category: 'food', isBestseller: false, createdAt: null, expiryDate: null, ...extra,
})

async function load() {
  vi.resetModules()
  const offers = await import('@/lib/firebase/offers')
  const api = await import('@/lib/offers/offersApi')
  return { offers, api }
}
const okResponse = (offers: unknown[]) => ({ ok: true, status: 200, json: async () => ({ offers }) }) as Response

beforeEach(() => {
  vi.useRealTimers()
  Object.values(fs).forEach((m) => 'mockClear' in m && (m as ReturnType<typeof vi.fn>).mockClear())
})

describe('getAllOffers', () => {
  it('shares one fetch between concurrent callers and callers within the TTL', async () => {
    const { offers } = await load()
    const fetchMock = vi.fn(async () => okResponse([wire('a'), wire('b')]))
    vi.stubGlobal('fetch', fetchMock)
    const [first, second] = await Promise.all([offers.getAllOffers(), offers.getAllOffers()])
    expect(first.map((o) => o.id)).toEqual(['a', 'b'])
    expect(second).toHaveLength(2)
    await offers.getAllOffers()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fs.getDocs).not.toHaveBeenCalled()
  })

  it('fetches again after the TTL, and when forced (pull-to-refresh)', async () => {
    const { offers } = await load()
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => okResponse([wire('a')]))
    vi.stubGlobal('fetch', fetchMock)
    await offers.getAllOffers()
    await offers.getAllOffers({ force: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(offers.OFFERS_CACHE_TTL_MS + 1)
    await offers.getAllOffers()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('falls back to Firestore, capped at 500, when the API is down, and revives dates', async () => {
    const { offers } = await load()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 }) as Response))
    fs.getDocs.mockResolvedValueOnce(snap([{ id: 'x', data: { title: 'X', createdAt: stamp(1000), expiryDate: null } }]))
    const result = await offers.getAllOffers()
    expect(result[0]).toMatchObject({ id: 'x', title: 'X', createdAt: new Date(1000) })
    expect(fs.limit).toHaveBeenCalledWith(500)
  })

  it('also falls back when the API payload is malformed, and never caches a failure', async () => {
    const { offers } = await load()
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ nope: 1 }) }) as Response)
    vi.stubGlobal('fetch', fetchMock)
    fs.getDocs.mockRejectedValueOnce(new Error('offline'))
    await expect(offers.getAllOffers()).rejects.toThrow('offline')
    fs.getDocs.mockResolvedValueOnce(snap([{ id: 'y', data: {} }]))
    expect((await offers.getAllOffers()).map((o) => o.id)).toEqual(['y'])
  })

  it('drops offers that have expired since the list was fetched', async () => {
    const { offers } = await load()
    vi.stubGlobal('fetch', vi.fn(async () => okResponse([
      wire('live', { expiryDate: new Date(Date.now() + day).toISOString() }),
      wire('gone', { expiryDate: new Date(Date.now() - day).toISOString() }),
      wire('open'),
    ])))
    expect((await offers.getAllOffers()).map((o) => o.id)).toEqual(['live', 'open'])
  })

  it('serves categories and bestsellers from the same shared list', async () => {
    const { offers } = await load()
    const fetchMock = vi.fn(async () => okResponse([wire('a'), wire('b', { category: 'spa', isBestseller: true })]))
    vi.stubGlobal('fetch', fetchMock)
    expect((await offers.getOffersByCategory('spa')).map((o) => o.id)).toEqual(['b'])
    expect((await offers.getBestsellerOffers()).map((o) => o.id)).toEqual(['b'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('offers API client', () => {
  it('calls the configured origin and skips rows that are not offers', async () => {
    const { api } = await load()
    api.setOffersApiBase('https://api.example.test/')
    const fetchMock = vi.fn(async (_url: string) => okResponse([wire('a'), null, { nope: true }, wire('b')]))
    const result = await api.fetchOffersFromApi(fetchMock as never)
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.example.test/api/public/offers')
    expect(result.map((o) => o.id)).toEqual(['a', 'b'])
  })
})

describe('getOffersByIds', () => {
  it('reads 30 ids per query (not one read each), asks for each id once, and keeps the caller order', async () => {
    const { offers } = await load()
    const ids = Array.from({ length: 65 }, (_, i) => `o${i}`)
    fs.getDocs.mockImplementation(async (q: { parts: [unknown, { where: [string, string, string[]] }] }) => {
      const requested = q.parts[1].where[2]
      // o3 has been deleted.
      return snap(requested.filter((id) => id !== 'o3').map((id) => ({ id, data: { title: id } })))
    })
    const result = await offers.getOffersByIds([...ids, 'o0'])
    expect(fs.getDocs).toHaveBeenCalledTimes(3)
    expect(fs.getDoc).not.toHaveBeenCalled()
    // One per requested id (o0 was asked for twice), minus the deleted o3.
    expect(result).toHaveLength(65)
    expect(result.map((o) => o.id).slice(0, 5)).toEqual(['o0', 'o1', 'o2', 'o4', 'o5'])
  })
})
