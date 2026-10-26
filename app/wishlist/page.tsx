'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import MemberPageShell, { PageTitle } from '@/components/layout/MemberPageShell'
import OfferCard, { OFFER_FEED_GRID } from '@/components/discover/OfferCard'
import { OfferGridSkeleton } from '@/components/ui/Skeleton'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import { useWishlist } from '@/lib/firebase/useWishlist'
import { getOffersByIds, type OfferDocument } from '@/lib/firebase/offers'

export default function WishlistPage() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  // Onboarding first: a member mid-wizard is sent back to it.
  const held = useOnboardingGuard()
  const router = useRouter()
  const { wishlistIds } = useWishlist()
  const [offers, setOffers] = useState<OfferDocument[] | undefined>(undefined)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getOffersByIds(wishlistIds).then((result) => {
      if (!cancelled) setOffers(result)
    })
    return () => { cancelled = true }
  }, [user, wishlistIds])

  if (loading || !user || held) {
    return (
      <>
        <Navbar />
        <div className="below-header member-canvas" />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="below-header member-canvas">
        <MemberPageShell>
          {/* Narrower than the column below 1024px, at its start edge, so the
              title lines up with the other tabs; the full column from there,
              so saved perks fill the feed's three or four columns. */}
          <div className="max-w-3xl lg:max-w-none">
            <PageTitle>{t('wishlist_title')}</PageTitle>

            {offers === undefined ? (
              <OfferGridSkeleton count={3} />
            ) : offers.length === 0 ? (
              <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
                <Heart aria-hidden="true" strokeWidth={1.5} />
                <div className="font-bold text-ink text-base mb-1">{t('wishlist_empty_title')}</div>
                <p className="text-sm text-body max-w-xs mb-5">{t('wishlist_empty_sub')}</p>
                <Link href="/categories" className="ds-btn ds-btn-primary">
                  <span>{t('nav_cta')}</span>
                </Link>
              </div>
            ) : (
              <div className={OFFER_FEED_GRID}>
                {offers.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} showWishlistButton layout="grid" />
                ))}
              </div>
            )}
          </div>
        </MemberPageShell>
      </div>
    </>
  )
}
