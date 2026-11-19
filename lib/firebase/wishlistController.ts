// The member's saved perks, held outside React so a heart tap re-renders only
// the card whose heart changed (useIsWishlisted subscribes per offer id) and
// the change shows on the frame of the tap, before Firestore answers.
//
// `server` is what the users/{uid} listener last delivered. A tap records an
// override for that offer and applies it at once; the override is dropped as
// soon as the listener shows the same state (Firestore's own pending-write
// snapshot usually confirms it within a frame or two). A write that fails
// rolls the heart back (only if no newer tap replaced it) and tells the error
// listeners, so the app can buzz and the website can show a short notice.

export type WishlistWriter = (offerId: string, wishlisted: boolean) => Promise<unknown>

interface Override {
  on: boolean
  token: number
}

export function createWishlistController() {
  let server: string[] = []
  const overrides = new Map<string, Override>()
  let ids: string[] = []
  let idSet = new Set<string>()
  let writer: WishlistWriter | null = null
  let token = 0
  const listeners = new Set<() => void>()
  const errorListeners = new Set<(error: unknown) => void>()

  function recompute() {
    const next = server.filter((id) => overrides.get(id)?.on !== false)
    for (const [id, override] of overrides) if (override.on && !next.includes(id)) next.push(id)
    ids = next
    idSet = new Set(next)
    listeners.forEach((listener) => listener())
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** Every saved id, the optimistic taps applied. A new array only when something changed. */
    getIds: () => ids,
    has: (offerId: string) => idSet.has(offerId),
    /** The listener's latest list; an override it confirms is dropped. */
    setServerIds(next: string[]) {
      server = next
      for (const [id, override] of overrides) if (next.includes(id) === override.on) overrides.delete(id)
      recompute()
    },
    /** Signed in: where taps are written. Signed out (null): every saved id and pending tap is cleared. */
    setWriter(next: WishlistWriter | null) {
      writer = next
      if (!next) {
        server = []
        overrides.clear()
        recompute()
      }
    },
    toggle(offerId: string) {
      const write = writer
      if (!write) return
      const on = !idSet.has(offerId)
      const mine = ++token
      overrides.set(offerId, { on, token: mine })
      recompute()
      let pending: Promise<unknown>
      try {
        pending = Promise.resolve(write(offerId, on))
      } catch (error) {
        pending = Promise.reject(error)
      }
      pending.catch((error: unknown) => {
        // Rolled back only while this tap is still the latest for the offer.
        if (overrides.get(offerId)?.token === mine) {
          overrides.delete(offerId)
          recompute()
        }
        errorListeners.forEach((listener) => listener(error))
      })
    },
    /** A write that failed and was rolled back. Returns the release. */
    onError(listener: (error: unknown) => void) {
      errorListeners.add(listener)
      return () => {
        errorListeners.delete(listener)
      }
    },
  }
}

export type WishlistController = ReturnType<typeof createWishlistController>
