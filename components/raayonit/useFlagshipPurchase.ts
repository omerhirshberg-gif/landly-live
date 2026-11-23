'use client'

import { useEffect, useState } from 'react'
import type { OfferDocument } from '@/lib/firebase/offers'
import { useAuth } from '@/lib/firebase/useAuth'
import { getClaimedPoolIds } from '@/lib/firebase/vouchers'
import { withRedirect } from '@/lib/auth/safeRedirect'
import { flagshipPurchase } from '@/lib/offers/flagshipPurchase'
import { checkoutPath, RAAYONIT_CARD_PAGE, RAAYONIT_HUB } from '@/lib/offers/offerRoutes'
import { showcaseCards, variantForDenomination, type ShowcaseCard } from '@/lib/home/superShowcase'

const FALLBACK: ShowcaseCard[] = [
  { denomination: 100, pool: '100', price: 89, value: 100, save: 11, discountPercent: 11, best: false, href: '' },
  { denomination: 150, pool: '150', price: 132, value: 150, save: 18, discountPercent: 12, best: false, href: '' },
  { denomination: 200, pool: '200', price: 174, value: 200, save: 26, discountPercent: 13, best: true, href: '' },
]

/**
 * The Raayonit Card's 1-click purchase (native: landly-mobile/src/lib/useFlagshipPurchase.ts): the selected value, the guards the offer
 * page used to apply (already owned, expired, sold out) and the checkout link. A guest's link goes through sign-in and comes back to
 * the checkout. `?denomination=` (an old offer link, redirected here) or `?variant=` (a pool id) starts out picking that value; otherwise the highest value is selected.
 */
export function useFlagshipPurchase(offer: OfferDocument | null) {
  const { user, loading } = useAuth()
  const [picked, setPicked] = useState('')
  const [claimedPools, setClaimedPools] = useState<string[]>([])
  const [now] = useState(Date.now)
  const variants = offer?.variants ?? []
  const defaultPoolId = variants[0]?.poolId ?? null
  const offerId = offer?.id

  useEffect(() => {
    if (!offer?.variants?.length) return
    const params = new URLSearchParams(window.location.search)
    const wanted = variantForDenomination(offer.variants, params.get('denomination')) ?? offer.variants.find((v) => v.poolId === params.get('variant')) ?? null
    if (wanted) setPicked((current) => current || wanted.poolId)
  }, [offer])

  useEffect(() => {
    // Unverified members cannot own a readable voucher, so there is nothing to read.
    if (!user || !user.emailVerified || !offerId) {
      setClaimedPools([])
      return
    }
    let cancelled = false
    getClaimedPoolIds(user.uid, offerId, defaultPoolId)
      .then((next) => { if (!cancelled) setClaimedPools(next.pools) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user, offerId, defaultPoolId])

  const live = offer ? showcaseCards(offer) : []
  const cards = live.length > 0 ? live : FALLBACK
  const { selected, block } = flagshipPurchase({ variants, picked, claimedPools, expiryDate: offer?.expiryDate, totalQuantity: offer?.totalQuantity, claimedCount: offer?.claimedCount, now, comingSoon: offer?.comingSoon === true })
  // With no live offer yet the highest value (the ladder's "Best value") shows selected.
  const fallbackCard = cards.find((c) => c.best) ?? cards[cards.length - 1]
  const selectedPool = selected?.poolId ?? fallbackCard?.pool ?? ''
  const card = cards.find((c) => c.pool === selectedPool) ?? fallbackCard
  const checkout = offer && selected ? checkoutPath(offer.id, selected.poolId) : null
  // Checkout is a full page load (not a client-side link): the accessibility widget script must not carry over beside the payment iframe.
  const href = checkout ? (user ? checkout : withRedirect('/login', checkout)) : null
  // The hub's "Order voucher" opens the details page first (what the voucher is, how to redeem, who accepts it, the value choice); its own button goes to checkout.
  const detailsHref = selected ? `${RAAYONIT_CARD_PAGE}?variant=${encodeURIComponent(selected.poolId)}` : null
  return { cards, card, selectedPool, ownedPools: claimedPools, block, select: setPicked, href, detailsHref, hubHref: RAAYONIT_HUB, ready: !!checkout && !loading }
}

export type FlagshipPurchaseState = ReturnType<typeof useFlagshipPurchase>
