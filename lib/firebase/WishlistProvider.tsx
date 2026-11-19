'use client'

import { createContext, ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from './config'
import { recheckSessionIfDenied } from './sessionCheck'
import { useAuth } from './useAuth'
import { getOffersByIds } from './offers'
import { setOfferWishlisted } from './users'
import { createWishlistController, type WishlistController } from './wishlistController'

interface WishlistContextValue {
  wishlistIds: string[]
  /** Saved perks whose offer still exists: what the badges show, so they match /wishlist. */
  wishlistCount: number
  isWishlisted: (offerId: string) => boolean
  toggleWishlist: (offerId: string) => void
}

export const WishlistContext = createContext<WishlistContextValue | null>(null)
/** The stable controller, for the per-card hooks (useIsWishlisted, useToggleWishlist): it never changes, so reading it re-renders nothing. */
export const WishlistControllerContext = createContext<WishlistController | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [controller] = useState(createWishlistController)
  const wishlistIds = useSyncExternalStore(controller.subscribe, controller.getIds, controller.getIds)
  // Ids looked up so far: true = the offer exists, false = it's gone (deleted,
  // or saved against another Firebase project). An id still being looked up,
  // or whose lookup failed, has no entry and counts as present, so a fresh
  // heart bumps the badge at once and a network error never hides one.
  const [exists, setExists] = useState<Map<string, boolean>>(() => new Map())
  const requested = useRef(new Set<string>())

  useEffect(() => {
    requested.current = new Set()
    setExists(new Map())
    if (!user) {
      controller.setWriter(null)
      return
    }
    const uid = user.uid
    controller.setWriter((offerId, wishlisted) => setOfferWishlisted(uid, offerId, wishlisted))
    const unsubscribe = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const data = snap.data()
        controller.setServerIds(Array.isArray(data?.wishlistOfferIds) ? data.wishlistOfferIds : [])
      },
      // Refused (a business or unverified session, or one revoked elsewhere):
      // the list stays as it was, and a revoked session is signed out.
      recheckSessionIfDenied
    )
    return () => {
      unsubscribe()
      controller.setWriter(null)
    }
  }, [user, controller])

  // Looks up each newly saved id once. One that's confirmed missing is taken
  // off the member's list (self-healing the stale badge); a failed lookup is
  // left alone and retried when the list next changes.
  useEffect(() => {
    if (!user) return
    const uid = user.uid
    const fresh = wishlistIds.filter((id) => !requested.current.has(id))
    if (fresh.length === 0) return
    fresh.forEach((id) => requested.current.add(id))
    // Read from the shared offer list, not one read per id.
    getOffersByIds(fresh)
      .then((offers) => {
        const found = new Set(offers.map((offer) => offer.id))
        setExists((prev) => {
          const next = new Map(prev)
          for (const id of fresh) next.set(id, found.has(id))
          return next
        })
        for (const id of fresh) if (!found.has(id)) setOfferWishlisted(uid, id, false).catch(() => {})
      })
      .catch(() => {
        fresh.forEach((id) => requested.current.delete(id))
      })
  }, [user, wishlistIds])

  const isWishlisted = useCallback((offerId: string) => controller.has(offerId), [controller])
  const toggleWishlist = useCallback((offerId: string) => controller.toggle(offerId), [controller])
  const wishlistCount = useMemo(() => wishlistIds.filter((id) => exists.get(id) !== false).length, [wishlistIds, exists])
  // `wishlistIds` is in the value so list screens and badges re-render when it changes; `isWishlisted` reads the same state.
  const value = useMemo<WishlistContextValue>(
    () => ({ wishlistIds, wishlistCount, isWishlisted, toggleWishlist }),
    [wishlistIds, wishlistCount, isWishlisted, toggleWishlist]
  )

  return (
    <WishlistControllerContext.Provider value={controller}>
      <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
    </WishlistControllerContext.Provider>
  )
}
