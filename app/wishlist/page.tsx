'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import MemberPageShell, { MemberColumn, PageTitle } from '@/components/layout/MemberPageShell'
import OfferCard from '@/components/discover/OfferCard'
import { OfferGridSkeleton } from '@/components/ui/Skeleton'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import { useWishlist } from '@/lib/firebase/useWishlist'
import { getOffersByIds, type OfferDocument } from '@/lib/firebase/offers'

// Saved perks as the same compact cards as Home and Perks: one column on phones, two from an
// unfolded foldable, then fixed 280px cards that never stretch, packed from the start edge.
const WISHLIST_GRID = 'grid grid-cols-1 gap-5 fold:grid-cols-2 lg:grid-cols-[repeat(auto-fill,280px)] lg:justify-start'

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
        <MemberPageShell fluid>
          {/* The wide fluid column of Home and Perks (up to 2200px, the same gutters), so the title and the
              cards share their start edge. Narrower than it below 1024px, at its start edge. */}
          <MemberColumn wide className="pb-10 sm:pb-12">
          <div className="max-w-3xl lg:max-w-none">
            <PageTitle>{t('wishlist_title')}</PageTitle>

            {offers === undefined ? (
              <OfferGridSkeleton count={3} gridClassName={WISHLIST_GRID} />
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
              <div className={WISHLIST_GRID}>
                {offers.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} showWishlistButton layout="grid" compact />
                ))}
              </div>
            )}
          </div>
          </MemberColumn>
        </MemberPageShell>
      </div>
    </>
  )
}
