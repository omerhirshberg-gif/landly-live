'use client'

import { createContext, ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from './config'
import { useAuth } from './useAuth'
import { getOffer } from './offers'
import { setOfferWishlisted } from './users'

interface WishlistContextValue {
  wishlistIds: string[]
  /** Saved perks whose offer still exists: what the badges show, so they match /wishlist. */
  wishlistCount: number
  isWishlisted: (offerId: string) => boolean
  toggleWishlist: (offerId: string) => void
}

export const WishlistContext = createContext<WishlistContextValue | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [wishlistIds, setWishlistIds] = useState<string[]>([])
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
      setWishlistIds([])
      return
    }
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const data = snap.data()
      setWishlistIds(Array.isArray(data?.wishlistOfferIds) ? data.wishlistOfferIds : [])
    })
    return unsubscribe
  }, [user])

  // Looks up each newly saved id once. One that's confirmed missing is taken
  // off the member's list (self-healing the stale badge); a failed lookup is
  // left alone and retried when the list next changes.
  useEffect(() => {
    if (!user) return
    const uid = user.uid
    for (const id of wishlistIds) {
      if (requested.current.has(id)) continue
      requested.current.add(id)
      getOffer(id)
        .then((offer) => {
          setExists((prev) => new Map(prev).set(id, !!offer))
          if (!offer) setOfferWishlisted(uid, id, false).catch(() => {})
        })
        .catch(() => {
          requested.current.delete(id)
        })
    }
  }, [user, wishlistIds])

  const toggleWishlist = useCallback((offerId: string) => {
    if (!user) return
    setOfferWishlisted(user.uid, offerId, !wishlistIds.includes(offerId))
  }, [user, wishlistIds])

  const value: WishlistContextValue = {
    wishlistIds,
    wishlistCount: wishlistIds.filter((id) => exists.get(id) !== false).length,
    isWishlisted: (offerId) => wishlistIds.includes(offerId),
    toggleWishlist,
  }

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}
