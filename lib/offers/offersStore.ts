import { offerFromWire, offerToWire, type OfferDocument } from './offerDocument'

// The live offer catalog as one shared, stale-while-revalidate store for the
// website and the Expo app (lib/firebase/offers.ts wires it to the CDN route
// and Firestore). A screen that mounts, a tab switch or a back navigation
// renders whatever copy is held at once; a copy older than `freshMs` is
// refreshed quietly behind it, and every subscribed screen re-renders together
// when the new list lands. The last good list is also saved on the device
// (AsyncStorage in the app, localStorage on the web) under a key scoped to the
// Firebase project, so a cold start draws the catalog without a skeleton and a
// DEV copy can never show in PROD. A saved copy older than `maxAgeMs` is
// dropped. Checkout never reads this: the server re-reads the offer inside its
// transaction, so a briefly stale price or stock count is never charged.

export const OFFERS_FRESH_MS = 60_000
export const OFFERS_MAX_AGE_MS = 24 * 60 * 60 * 1000
export const OFFERS_STORE_VERSION = 1
/**
 * The saved list is split into parts of this many characters under `${key}:0`, `${key}:1`, ...: Android's
 * AsyncStorage can't read back a single row over 2MB (Hebrew text is 2 bytes a character in UTF-8), and the
 * live catalog's JSON is about 2M characters. The key itself holds only { v, at, parts }.
 */
export const OFFERS_PERSIST_PART_CHARS = 400_000
/** A list bigger than this isn't saved (a browser's localStorage holds about 5M characters for the whole site). */
export const OFFERS_PERSIST_MAX_CHARS = 4_000_000
const MAX_PARTS = Math.ceil(OFFERS_PERSIST_MAX_CHARS / OFFERS_PERSIST_PART_CHARS)
const partKey = (key: string, index: number) => `${key}:${index}`

/** AsyncStorage and a wrapped localStorage both fit. Every call may throw or reject; the store never lets that surface. */
export interface OffersStorage {
  getItem(key: string): Promise<string | null> | string | null
  setItem(key: string, value: string): Promise<void> | void
  removeItem(key: string): Promise<void> | void
}

export interface OffersSnapshot {
  /** The unexpired offers, or null while nothing has loaded yet. */
  offers: OfferDocument[] | null
  /** The last load failed and there is no copy to show. */
  failed: boolean
  /** When the list held was fetched (0 for none). */
  fetchedAt: number
}

export function offersStorageKey(projectId: string): string {
  return `offers:v${OFFERS_STORE_VERSION}:${projectId}`
}

const EMPTY: OffersSnapshot = { offers: null, failed: false, fetchedAt: 0 }

export interface OffersStoreOptions {
  load: () => Promise<OfferDocument[]>
  /** The save slot's key, or null for no saving (no project id known, e.g. in tests). */
  storageKey?: string | null
  storage?: OffersStorage | null
  now?: () => number
  freshMs?: number
  maxAgeMs?: number
}

export function createOffersStore({ load, storageKey = null, storage = null, now = () => Date.now(), freshMs = OFFERS_FRESH_MS, maxAgeMs = OFFERS_MAX_AGE_MS }: OffersStoreOptions) {
  let all: OfferDocument[] | null = null
  let fetchedAt = 0
  let failed = false
  let snapshot: OffersSnapshot = EMPTY
  // The earliest expiry still ahead: past it, the next read filters the list again.
  let nextExpiry = Infinity
  let inflight: Promise<OfferDocument[]> | null = null
  // Only the newest load may write: a forced refresh or a clear wins over a load already in flight.
  let generation = 0
  let inflightGeneration = 0
  let hydration: Promise<void> | null = null
  const listeners = new Set<() => void>()

  function filterLive(list: OfferDocument[], at: number) {
    let soonest = Infinity
    const live = list.filter((offer) => {
      if (!offer.expiryDate) return true
      const end = offer.expiryDate.getTime()
      if (end < at) return false
      if (end < soonest) soonest = end
      return true
    })
    return { live, soonest }
  }

  function rebuild() {
    if (all) {
      const { live, soonest } = filterLive(all, now())
      nextExpiry = soonest
      snapshot = { offers: live, failed: false, fetchedAt }
    } else {
      nextExpiry = Infinity
      snapshot = failed ? { offers: null, failed: true, fetchedAt: 0 } : EMPTY
    }
  }

  function publish() {
    rebuild()
    listeners.forEach((listener) => listener())
  }

  function getSnapshot(): OffersSnapshot {
    // An offer that expired while the list was held drops out on the next read; the same object is returned until then.
    if (now() > nextExpiry) rebuild()
    return snapshot
  }

  function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  async function removeSaved(target: OffersStorage, key: string) {
    // The header first, so a half-removed copy is never read; then every part slot there could be.
    await target.removeItem(key)
    await Promise.all(Array.from({ length: MAX_PARTS }, (_, i) => target.removeItem(partKey(key, i))))
  }

  async function persist(list: OfferDocument[], at: number) {
    const target = storage
    const key = storageKey
    if (!target || !key) return
    try {
      const raw = JSON.stringify(list.map(offerToWire))
      if (raw.length > OFFERS_PERSIST_MAX_CHARS) return
      const parts: string[] = []
      for (let i = 0; i < raw.length; i += OFFERS_PERSIST_PART_CHARS) parts.push(raw.slice(i, i + OFFERS_PERSIST_PART_CHARS))
      // Parts first, then the header that names them: a write cut short leaves a header whose parts don't parse, which is discarded.
      await Promise.all(parts.map((part, i) => target.setItem(partKey(key, i), part)))
      await target.setItem(key, JSON.stringify({ v: OFFERS_STORE_VERSION, at, parts: parts.length }))
    } catch {
      // Storage full or unavailable: drop whatever half-copy was written; the next cold start loads from the network.
      try {
        await removeSaved(target, key)
      } catch {
        // Nothing more to do.
      }
    }
  }

  function hydrate(): Promise<void> {
    if (!hydration) {
      hydration = (async () => {
        if (!storage || !storageKey || all) return
        const startedAt = generation
        try {
          const target = storage
          const key = storageKey
          const header = await target.getItem(key)
          // A load (or a clear) that finished meanwhile is newer than the saved copy.
          if (!header || all || generation !== startedAt) return
          const saved = JSON.parse(header) as { v?: unknown; at?: unknown; parts?: unknown }
          const at = typeof saved.at === 'number' ? saved.at : NaN
          const age = now() - at
          const count = typeof saved.parts === 'number' && Number.isInteger(saved.parts) && saved.parts > 0 && saved.parts <= MAX_PARTS ? saved.parts : 0
          if (saved.v !== OFFERS_STORE_VERSION || !count || !(age >= 0 && age <= maxAgeMs)) {
            await removeSaved(target, key)
            return
          }
          const parts = await Promise.all(Array.from({ length: count }, (_, i) => target.getItem(partKey(key, i))))
          if (all || generation !== startedAt) return
          if (parts.some((part) => typeof part !== 'string')) {
            await removeSaved(target, key)
            return
          }
          const offers = JSON.parse(parts.join('')) as unknown
          if (!Array.isArray(offers)) return
          all = offers.map(offerFromWire).filter((offer): offer is OfferDocument => offer !== null)
          fetchedAt = at
          publish()
        } catch {
          // Unreadable or corrupt: ignored, the network copy replaces it.
        }
      })()
    }
    return hydration
  }

  function revalidate(force = false): Promise<OfferDocument[]> {
    if (inflight && !force) return inflight
    const mine = ++generation
    inflightGeneration = mine
    const request = (async () => {
      try {
        // Started from a microtask, so even a load that throws at once settles after `inflight` below is set.
        const next = await Promise.resolve().then(load)
        if (mine === generation) {
          all = next
          fetchedAt = now()
          failed = false
          publish()
          void persist(next, fetchedAt)
        }
        return next
      } catch (error) {
        if (mine === generation) {
          failed = true
          publish()
        }
        throw error
      } finally {
        if (mine === inflightGeneration) inflight = null
      }
    })()
    inflight = request
    return request
  }

  const liveNow = (list: OfferDocument[]) => filterLive(list, now()).live

  /**
   * The live offers. A held copy comes back at once (refreshed behind the
   * scenes once it is older than `freshMs`); with none, it waits for the load.
   * `force` (pull-to-refresh) always waits for a new load.
   */
  async function get({ force = false }: { force?: boolean } = {}): Promise<OfferDocument[]> {
    if (force) return liveNow(await revalidate(true))
    await hydrate()
    if (all) {
      if (now() - fetchedAt > freshMs) revalidate().catch(() => {})
      return getSnapshot().offers ?? []
    }
    return liveNow(await revalidate())
  }

  /** Drops the held and saved copies, e.g. after the member signs out. */
  function clear() {
    generation++
    inflight = null
    all = null
    fetchedAt = 0
    failed = false
    if (storage && storageKey) {
      // Nothing saved, or storage unavailable: either way there is nothing left to drop.
      removeSaved(storage, storageKey).catch(() => {})
    }
    publish()
  }

  /** Swaps the save slot (the app passes AsyncStorage at startup). A copy not read yet is read from the new one. */
  function setStorage(next: OffersStorage | null) {
    storage = next
    if (!all) hydration = null
  }

  return { get, getSnapshot, getServerSnapshot: () => EMPTY, subscribe, hydrate, clear, setStorage }
}

export type OffersStore = ReturnType<typeof createOffersStore>

/** The browser's localStorage as an OffersStorage, or null where there is none (the server, a blocked iframe). */
export function browserOffersStorage(): OffersStorage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const ls = window.localStorage
    return {
      getItem: (key) => ls.getItem(key),
      setItem: (key, value) => ls.setItem(key, value),
      removeItem: (key) => ls.removeItem(key),
    }
  } catch {
    return null
  }
}
