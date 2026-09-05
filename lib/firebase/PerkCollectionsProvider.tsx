'use client'

import { createContext, ReactNode, useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from './config'
import { useAuth } from './useAuth'
import { setPerkInCart, setPerkWishlisted } from './users'

interface PerkCollectionsContextValue {
  wishlistIds: string[]
  cartIds: string[]
  isWishlisted: (perkId: string) => boolean
  isInCart: (perkId: string) => boolean
  toggleWishlist: (perkId: string) => void
  toggleCart: (perkId: string) => void
}

export const PerkCollectionsContext = createContext<PerkCollectionsContextValue | null>(null)

export function PerkCollectionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [wishlistIds, setWishlistIds] = useState<string[]>([])
  const [cartIds, setCartIds] = useState<string[]>([])

  useEffect(() => {
    if (!user) {
      setWishlistIds([])
      setCartIds([])
      return
    }
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const data = snap.data()
      setWishlistIds(Array.isArray(data?.wishlistPerkIds) ? data.wishlistPerkIds : [])
      setCartIds(Array.isArray(data?.cartPerkIds) ? data.cartPerkIds : [])
    })
    return unsubscribe
  }, [user])

  const toggleWishlist = useCallback((perkId: string) => {
    if (!user) return
    setPerkWishlisted(user.uid, perkId, !wishlistIds.includes(perkId))
  }, [user, wishlistIds])

  const toggleCart = useCallback((perkId: string) => {
    if (!user) return
    setPerkInCart(user.uid, perkId, !cartIds.includes(perkId))
  }, [user, cartIds])

  const value: PerkCollectionsContextValue = {
    wishlistIds,
    cartIds,
    isWishlisted: (perkId) => wishlistIds.includes(perkId),
    isInCart: (perkId) => cartIds.includes(perkId),
    toggleWishlist,
    toggleCart,
  }

  return <PerkCollectionsContext.Provider value={value}>{children}</PerkCollectionsContext.Provider>
}
