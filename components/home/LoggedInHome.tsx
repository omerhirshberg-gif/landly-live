'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { User } from 'firebase/auth'
import Avatar from '@/components/ui/Avatar'
import AvatarLightbox from '@/components/ui/AvatarLightbox'
import CategoryIcon from '@/components/ui/CategoryIcon'
import OfferCardRail from '@/components/discover/OfferCardRail'
import SectionBoundary from '@/components/errors/SectionBoundary'
import ActivePassCard from './ActivePassCard'
import CategoryPhotoRail, { CategoryPhotoTitle } from './CategoryPhotoRail'
import CuratedOffers from './CuratedOffers'
import MemberPageShell, { MemberColumn, PAGE_TITLE } from '@/components/layout/MemberPageShell'
import SegmentBadge from '@/components/member/SegmentBadge'
import { getAllOffers, type OfferDocument } from '@/lib/firebase/offers'
import { useMemberProfile } from '@/lib/firebase/useMemberProfile'
import { subscribeToUserVouchers } from '@/lib/firebase/vouchers'
import { buildCategoryRails, railLabel, selectCurated } from '@/lib/home/categoryRails'
import { useLang } from '@/lib/i18n/useLang'
import { categoryHref } from '@/lib/perks/perksFilter'

// The signed-in home: the member's greeting, the blue member-pass card with
// their live active-pass count, quick category pills, Recommended for you, then
// a rail for each category with a claimable perk (lib/home/categoryRails.ts), so
// a category appears by itself with its first offer. The greeting and card sit
// on the 1240px column; the rails reach the screen's edges. Guest marketing
// never renders here. Same order as the Expo Home tab
// (landly-mobile/src/app/(tabs)/index.tsx).
//
// "Welcome, {firstName}" comes from the profile (falling back to the display
// name, never the email). The greeting row holds its space until the profile
// is read, then fades and rises in, so a fallback name never flashes first.
export default function LoggedInHome({ user }: { user: User }) {
  const { t } = useLang()
  const { loaded, profile, firstName, initials, photoURL } = useMemberProfile(user)
  // null until the first snapshot (or if the read is refused): the card shows "–", never a fake 0.
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [offers, setOffers] = useState<OfferDocument[] | null>(null)
  const [photoOpen, setPhotoOpen] = useState(false)

  // Live, like the Expo wallet: a purchase or a redemption updates the count without a reload.
  useEffect(
    () =>
      subscribeToUserVouchers(
        user.uid,
        'active',
        (vouchers) => setActiveCount(vouchers.length),
        () => setActiveCount(null)
      ),
    [user.uid]
  )

  // One read for the whole page; a failed read shows the empty state.
  useEffect(() => {
    let cancelled = false
    getAllOffers()
      .then((all) => {
        if (!cancelled) setOffers(all)
      })
      .catch(() => {
        if (!cancelled) setOffers([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const curated = useMemo(() => (offers ? selectCurated(offers) : null), [offers])
  const rails = useMemo(() => (offers ? buildCategoryRails(offers) : []), [offers])

  return (
    <main className="member-canvas below-header min-h-[100dvh] overflow-x-clip">
      {/* No site footer for members: the support prompt is pinned to the bottom of the screen instead, clear of the iPhone home indicator. */}
      <MemberPageShell
        fluid
        footer={
          <p className="text-center text-sm text-body">
            {t('home_faq_prompt_pre')}{' '}
            <Link href="/support" className="text-brand font-semibold hover:underline">
              {t('home_faq_prompt_link')}
            </Link>
          </p>
        }
      >
        <MemberColumn>
          <header className={`flex items-center gap-3 sm:gap-4 min-w-0 min-h-14 ${loaded ? 'greet-in' : 'invisible'}`}>
            {/* With a photo, the avatar opens it full size; a monogram has nothing to zoom, so it opens /profile. */}
            {photoURL ? (
              <button type="button" onClick={() => setPhotoOpen(true)} aria-label={t('avatar_view')} aria-haspopup="dialog" className="tap-target flex-shrink-0 rounded-full cursor-zoom-in">
                <Avatar src={photoURL} initials={initials} size={56} />
              </button>
            ) : (
              <Link href="/profile" aria-label={t('nav_profile')} className="tap-target flex-shrink-0 rounded-full">
                <Avatar src={photoURL} initials={initials} size={56} />
              </Link>
            )}
            <div className="min-w-0">
              <h1 id="home-welcome" className={`${PAGE_TITLE} truncate`}>
                {firstName ? t('home_welcome').replace('{name}', firstName) : t('home_welcome_generic')}
              </h1>
              <div className="mt-1.5">
                <SegmentBadge customerType={profile?.customerType} customerTypeOther={profile?.customerTypeOther} />
              </div>
            </div>
          </header>
          {photoURL && <AvatarLightbox src={photoURL} open={photoOpen} onClose={() => setPhotoOpen(false)} />}
          <ActivePassCard count={activeCount} />
        </MemberColumn>

        <SectionBoundary name="home-category-photos">
          <section aria-labelledby="home-categories-title" className="mt-6 sm:mt-8">
            <MemberColumn>
              <CategoryPhotoTitle id="home-categories-title" className="mb-3 text-xl font-bold text-ink" />
            </MemberColumn>
            <CategoryPhotoRail />
          </section>
        </SectionBoundary>

        <div className="mt-6 space-y-7 sm:mt-8 sm:space-y-9">
          <SectionBoundary name="home-curated"><CuratedOffers offers={curated} /></SectionBoundary>
          {rails.map((rail, index) => (
            <SectionBoundary key={rail.category} name="home-category-rail">
              <OfferCardRail
                id={`home-rail-${index}`}
                title={railLabel(rail, t)}
                glyph={<CategoryIcon category={rail.category} className="h-[18px] w-[18px] flex-shrink-0 text-brand" strokeWidth={1.5} />}
                offers={rail.offers}
                href={rail.tile ? categoryHref(rail.tile.category) : undefined}
                seeAll={rail.tile ? t('home_see_all') : undefined}
                count={rail.total}
                showCategoryBadge={false}
              />
            </SectionBoundary>
          ))}
        </div>
      </MemberPageShell>
    </main>
  )
}
