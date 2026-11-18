import { describe, expect, it, vi } from 'vitest'
import { createOffersStore, offersStorageKey, OFFERS_FRESH_MS, OFFERS_MAX_AGE_MS, OFFERS_PERSIST_PART_CHARS, OFFERS_STORE_VERSION, type OffersStorage } from '@/lib/offers/offersStore'
import type { OfferDocument } from '@/lib/offers/offerDocument'

// The shared stale-while-revalidate catalog (lib/offers/offersStore.ts), driven
// with a fake clock, a fake load and an in-memory storage: no Firebase, no network.

const offer = (id: string, extra: Partial<OfferDocument> = {}) => ({ id, title: id, category: 'food', createdAt: null, expiryDate: null, ...extra }) as unknown as OfferDocument

function memoryStorage(initial: Record<string, string> = {}): OffersStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value)
    },
    removeItem: async (key) => {
      data.delete(key)
    },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const KEY = offersStorageKey('landly-dev')
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('offersStore', () => {
  it('scopes the saved copy to the Firebase project and the schema version', () => {
    expect(KEY).toBe(`offers:v${OFFERS_STORE_VERSION}:landly-dev`)
    expect(offersStorageKey('landly-be752')).not.toBe(KEY)
  })

  it('returns the held copy at once and refreshes it quietly once it is stale', async () => {
    let clock = 1_000_000
    const next = deferred<OfferDocument[]>()
    const load = vi.fn().mockResolvedValueOnce([offer('a')]).mockReturnValueOnce(next.promise)
    const store = createOffersStore({ load, now: () => clock })

    expect((await store.get()).map((o) => o.id)).toEqual(['a'])
    clock += OFFERS_FRESH_MS + 1
    // Stale: the old list comes back immediately, without waiting for the second load.
    expect((await store.get()).map((o) => o.id)).toEqual(['a'])
    await settle()
    expect(load).toHaveBeenCalledTimes(2)

    const seen: string[][] = []
    store.subscribe(() => seen.push(store.getSnapshot().offers!.map((o) => o.id)))
    next.resolve([offer('a'), offer('b')])
    await settle()
    expect(seen.at(-1)).toEqual(['a', 'b'])
  })

  it('does not refresh a copy that is still fresh, and shares one in-flight load', async () => {
    const load = vi.fn().mockResolvedValue([offer('a')])
    const store = createOffersStore({ load })
    await Promise.all([store.get(), store.get(), store.get()])
    await store.get()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('keeps the stale copy when a refresh fails, and only reports a failure with nothing to show', async () => {
    let clock = 0
    const load = vi.fn().mockResolvedValueOnce([offer('a')]).mockRejectedValueOnce(new Error('offline'))
    const store = createOffersStore({ load, now: () => clock })
    await store.get()
    clock += OFFERS_FRESH_MS + 1
    await store.get()
    await settle()
    expect(store.getSnapshot()).toMatchObject({ failed: false })
    expect(store.getSnapshot().offers!.map((o) => o.id)).toEqual(['a'])

    const empty = createOffersStore({ load: vi.fn().mockRejectedValue(new Error('offline')) })
    await expect(empty.get()).rejects.toThrow('offline')
    expect(empty.getSnapshot()).toEqual({ offers: null, failed: true, fetchedAt: 0 })
  })

  it('never caches a failure: the next read loads again', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([offer('b')])
    const store = createOffersStore({ load })
    await expect(store.get()).rejects.toThrow('offline')
    expect((await store.get()).map((o) => o.id)).toEqual(['b'])
  })

  it('a load that throws at once still clears its in-flight slot', async () => {
    const load = vi.fn<() => Promise<OfferDocument[]>>()
      .mockImplementationOnce(() => {
        throw new Error('sync')
      })
      .mockResolvedValueOnce([offer('c')])
    const store = createOffersStore({ load })
    await expect(store.get()).rejects.toThrow('sync')
    expect((await store.get()).map((o) => o.id)).toEqual(['c'])
  })

  it('filters expired offers once, and again only after the next expiry passes', async () => {
    let clock = 10_000
    const store = createOffersStore({
      load: async () => [offer('open'), offer('soon', { expiryDate: new Date(20_000) }), offer('gone', { expiryDate: new Date(5_000) })],
      now: () => clock,
    })
    await store.get()
    const first = store.getSnapshot()
    expect(first.offers!.map((o) => o.id)).toEqual(['open', 'soon'])
    // Same object until something expires, as useSyncExternalStore requires.
    expect(store.getSnapshot()).toBe(first)
    clock = 20_001
    expect(store.getSnapshot().offers!.map((o) => o.id)).toEqual(['open'])
  })

  it('forced refresh (pull-to-refresh) waits for a new load and wins over one already in flight', async () => {
    const slow = deferred<OfferDocument[]>()
    const load = vi.fn().mockReturnValueOnce(slow.promise).mockResolvedValueOnce([offer('fresh')])
    const store = createOffersStore({ load })
    const first = store.get()
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
    expect((await store.get({ force: true })).map((o) => o.id)).toEqual(['fresh'])
    slow.resolve([offer('old')])
    await first
    expect(store.getSnapshot().offers!.map((o) => o.id)).toEqual(['fresh'])
  })

  it('saves the last good list and draws it on a cold start before the network answers', async () => {
    const storage = memoryStorage()
    let clock = 50_000
    const warm = createOffersStore({ load: async () => [offer('a', { expiryDate: new Date(9e12) })], storage, storageKey: KEY, now: () => clock })
    await warm.get()
    await settle()
    expect(JSON.parse(storage.data.get(KEY)!)).toMatchObject({ v: OFFERS_STORE_VERSION, at: 50_000 })

    clock += OFFERS_FRESH_MS + 5
    const network = deferred<OfferDocument[]>()
    const load = vi.fn().mockReturnValue(network.promise)
    const cold = createOffersStore({ load, storage, storageKey: KEY, now: () => clock })
    const result = await cold.get()
    expect(result.map((o) => o.id)).toEqual(['a'])
    // Dates come back as dates.
    expect(result[0]!.expiryDate).toBeInstanceOf(Date)
    // The saved copy is a minute old: refreshed behind it.
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('discards a saved copy older than 24h, from another schema version, or corrupt', async () => {
    const now = 100 * OFFERS_MAX_AGE_MS
    for (const raw of [
      JSON.stringify({ v: OFFERS_STORE_VERSION, at: now - OFFERS_MAX_AGE_MS - 1, offers: [offer('old')] }),
      JSON.stringify({ v: OFFERS_STORE_VERSION + 1, at: now, offers: [offer('future')] }),
      '{not json',
    ]) {
      const storage = memoryStorage({ [KEY]: raw })
      const store = createOffersStore({ load: async () => [offer('net')], storage, storageKey: KEY, now: () => now })
      expect((await store.get()).map((o) => o.id)).toEqual(['net'])
    }
  })

  it('saves a catalog bigger than one storage row in parts, and reads it back whole (Android rows stop at 2MB)', async () => {
    const storage = memoryStorage()
    // About 3 parts' worth: Hebrew titles, like the live catalog.
    const big = Array.from({ length: 900 }, (_, i) => offer(`o${i}`, { title: 'הטבה '.repeat(300) + i }))
    const warm = createOffersStore({ load: async () => big, storage, storageKey: KEY, now: () => 1 })
    await warm.get()
    await settle()
    const header = JSON.parse(storage.data.get(KEY)!)
    expect(header.parts).toBeGreaterThan(1)
    for (let i = 0; i < header.parts; i++) expect(storage.data.get(`${KEY}:${i}`)!.length).toBeLessThanOrEqual(OFFERS_PERSIST_PART_CHARS)

    const cold = createOffersStore({ load: () => new Promise(() => {}), storage, storageKey: KEY, now: () => 2 })
    const result = await cold.get()
    expect(result).toHaveLength(900)
    expect(result[899]!.title).toBe(big[899]!.title)

    cold.clear()
    await settle()
    expect([...storage.data.keys()].filter((k) => k.startsWith(KEY))).toEqual([])
  })

  it('discards a saved copy with a part missing', async () => {
    const storage = memoryStorage()
    const big = Array.from({ length: 900 }, (_, i) => offer(`o${i}`, { title: 'x'.repeat(1200) }))
    await createOffersStore({ load: async () => big, storage, storageKey: KEY, now: () => 1 }).get()
    await settle()
    storage.data.delete(`${KEY}:1`)
    const cold = createOffersStore({ load: async () => [offer('net')], storage, storageKey: KEY, now: () => 2 })
    expect((await cold.get()).map((o) => o.id)).toEqual(['net'])
  })

  it('never reads or writes a DEV copy under the PROD key', async () => {
    const storage = memoryStorage({ [offersStorageKey('landly-dev')]: JSON.stringify({ v: OFFERS_STORE_VERSION, at: 0, offers: [offer('dev')] }) })
    const prod = createOffersStore({ load: async () => [offer('prod')], storage, storageKey: offersStorageKey('landly-be752'), now: () => 1 })
    expect((await prod.get()).map((o) => o.id)).toEqual(['prod'])
  })

  it('a storage that throws never breaks a read', async () => {
    const broken: OffersStorage = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('full')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    }
    const store = createOffersStore({ load: async () => [offer('a')], storage: broken, storageKey: KEY })
    expect((await store.get()).map((o) => o.id)).toEqual(['a'])
    store.clear()
    expect(store.getSnapshot().offers).toBeNull()
  })

  it('clear drops the held and saved copies and ignores a load still in flight', async () => {
    const storage = memoryStorage()
    const slow = deferred<OfferDocument[]>()
    const load = vi.fn().mockResolvedValueOnce([offer('a')]).mockReturnValueOnce(slow.promise)
    const store = createOffersStore({ load, storage, storageKey: KEY })
    await store.get()
    await settle()
    expect(storage.data.has(KEY)).toBe(true)
    const pending = store.get({ force: true })
    store.clear()
    slow.resolve([offer('late')])
    await pending
    await settle()
    expect(store.getSnapshot().offers).toBeNull()
    expect(storage.data.has(KEY)).toBe(false)
  })
})
