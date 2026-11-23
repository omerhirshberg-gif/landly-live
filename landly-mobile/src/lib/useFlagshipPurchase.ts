import { useCallback, useState } from 'react'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAuth } from '@shared/firebase/useAuth'
import { getClaimedPoolIds } from '@shared/firebase/vouchers'
import type { OfferDocument } from '@shared/firebase/offers'
import { flagshipPurchase } from '@shared/offers/flagshipPurchase'
import { showcaseCards, variantForDenomination, type ShowcaseCard } from '@shared/home/superShowcase'
import { RAAYONIT_HUB } from '@shared/offers/offerRoutes'
import { rememberOffer } from './openOffer'

const FALLBACK: ShowcaseCard[] = [
  { denomination: 100, pool: '100', price: 89, value: 100, save: 11, discountPercent: 11, best: false, href: '' },
  { denomination: 150, pool: '150', price: 132, value: 150, save: 18, discountPercent: 12, best: false, href: '' },
  { denomination: 200, pool: '200', price: 174, value: 200, save: 26, discountPercent: 13, best: true, href: '' },
]

/**
 * The Raayonit Card's 1-click purchase (web: components/raayonit/useFlagshipPurchase.ts): the selected value, the guards the offer
 * screen used to apply (already owned, expired, sold out) and `buy`, which goes straight to the native checkout.
 */
export function useFlagshipPurchase(offer: OfferDocument | null) {
  const { user } = useAuth()
  const uid = user?.uid
  const [picked, setPicked] = useState('')
  const [claimedPools, setClaimedPools] = useState<string[]>([])
  const [now] = useState(Date.now)
  const variants = offer?.variants ?? []
  const defaultPoolId = variants[0]?.poolId ?? null
  const offerId = offer?.id
  // `?denomination=` (a value in shekels) or `?variant=` (a pool id) starts out picking that value; otherwise the highest value is selected.
  const { denomination, variant } = useLocalSearchParams<{ denomination?: string; variant?: string }>()
  const wanted = variantForDenomination(variants, denomination) ?? variants.find((v) => v.poolId === variant) ?? null

  // Re-read on focus: a finished purchase comes back to this screen with that value owned.
  useFocusEffect(
    useCallback(() => {
      if (!uid || !offerId) return
      let cancelled = false
      getClaimedPoolIds(uid, offerId, defaultPoolId)
        .then((next) => { if (!cancelled) setClaimedPools(next.pools) })
        .catch(() => {})
      return () => { cancelled = true }
    }, [uid, offerId, defaultPoolId])
  )

  const live = offer ? showcaseCards(offer) : []
  const cards = live.length > 0 ? live : FALLBACK
  const { selected, block } = flagshipPurchase({ variants, picked: picked || wanted?.poolId || '', claimedPools, expiryDate: offer?.expiryDate, totalQuantity: offer?.totalQuantity, claimedCount: offer?.claimedCount, now, comingSoon: offer?.comingSoon === true })
  // With no live offer the fallback tiles are only a preview: the first one stands in as selected.
  // With no live offer yet the highest value (the ladder's "Best value") shows selected.
  const fallbackCard = cards.find((c) => c.best) ?? cards[cards.length - 1]
  const selectedPool = selected?.poolId ?? fallbackCard?.pool ?? ''
  const card = cards.find((c) => c.pool === selectedPool) ?? fallbackCard

  const buy = () => {
    if (!offer || !selected || block) return
    rememberOffer(offer)
    router.push({ pathname: '/checkout/[offerId]', params: { offerId: offer.id, variant: selected.poolId } })
  }
  // The hub's "More details & purchase" opens the details page with the chosen value; its own button goes on to checkout (`buy`).
  const openDetails = () => {
    if (!offer) return router.push(RAAYONIT_HUB)
    router.push({ pathname: '/raayonit-card', params: selected ? { variant: selected.poolId } : {} })
  }
  const openHub = () => router.push(RAAYONIT_HUB)
  return { cards, card, selectedPool, ownedPools: claimedPools, block, select: setPicked, buy, openDetails, openHub, ready: !!offer && !!selected }
}
