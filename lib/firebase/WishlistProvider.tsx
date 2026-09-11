'use client'

import { createContext, ReactNode, useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from './config'
import { useAuth } from './useAuth'
import { setOfferWishlisted } from './users'

interface WishlistContextValue {
  wishlistIds: string[]
  isWishlisted: (offerId: string) => boolean
  toggleWishlist: (offerId: string) => void
}

export const WishlistContext = createContext<WishlistContextValue | null>(null)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [wishlistIds, setWishlistIds] = useState<string[]>([])

  useEffect(() => {
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

  const toggleWishlist = useCallback((offerId: string) => {
    if (!user) return
    setOfferWishlisted(user.uid, offerId, !wishlistIds.includes(offerId))
  }, [user, wishlistIds])

  const value: WishlistContextValue = {
    wishlistIds,
    isWishlisted: (offerId) => wishlistIds.includes(offerId),
    toggleWishlist,
  }

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}
