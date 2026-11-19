'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { Award, Sparkles } from 'lucide-react'
import type { User } from 'firebase/auth'
import Avatar from '@/components/ui/Avatar'
import AvatarLightbox from '@/components/ui/AvatarLightbox'
import CategoryIcon from '@/components/ui/CategoryIcon'
import OfferCardRail from '@/components/discover/OfferCardRail'
import SectionBoundary from '@/components/errors/SectionBoundary'
import ActivePassCard from './ActivePassCard'
import MultiChainShowcase from '@/components/discover/MultiChainShowcase'
import CategoryPhotoRail, { CategoryPhotoTitle } from './CategoryPhotoRail'
import CuratedOffers from './CuratedOffers'
import MemberPageShell, { MemberColumn, PAGE_TITLE } from '@/components/layout/MemberPageShell'
import LocationFilterBar from '@/components/discover/LocationFilterBar'
import { usePerksSearch } from '@/lib/perks/PerksSearchProvider'
import { applyLocationFilter } from '@/lib/perks/locationFilter'
import { useOffers } from '@/lib/offers/useOffers'
import { useMemberProfile } from '@/lib/firebase/useMemberProfile'
import { useVouchers } from '@/lib/firebase/VouchersProvider'
import { greetingKey } from '@/lib/auth/greeting'
import { useGreetingPeriod } from '@/lib/home/useGreetingPeriod'
import { buildCategoryRails, railLabel, selectCurated, selectHighlights, selectSuperVouchers } from '@/lib/home/categoryRails'
import { useLang } from '@/lib/i18n/useLang'
import { categoryHref } from '@/lib/perks/perksFilter'

// The signed-in home: the member's greeting, the blue member-pass card with
// their live active-pass count, quick category pills, Recommended for you, then
// a rail for each category with a claimable perk (lib/home/categoryRails.ts), so
// a category appears by itself with its first offer. The greeting, card and rails
// share one fluid column up to 2200px (below 1024px the greeting and a card up to
// 680px wide form one centred hero; from there a text-only welcome on the start
// edge replaces both, since the navbar has My Pass and the avatar); the rails reach the screen's edges below 1024px and fill the column from
// there: fixed 280px compact cards and seven or eight category tiles. Guest marketing
// never renders here. Same order as the Expo Home tab
// (landly-mobile/src/app/(tabs)/index.tsx).
//
// "Welcome, {firstName}" comes from the profile (falling back to the display
// name, never the email). The greeting row holds its space until the profile
// is read, then fades and rises in, so a fallback name never flashes first.
export default function LoggedInHome({ user }: { user: User }) {
  const { t } = useLang()
  const { loaded, firstName, initials, photoURL } = useMemberProfile(user)
  // "Good morning, Dana" by the member's own clock; the plain welcome only until that is read (the greeting is hidden until then).
  const period = useGreetingPeriod()
  const greeting = period
    ? t(greetingKey(period, !!firstName)).replace('{name}', firstName ?? '')
    : firstName ? t('home_welcome').replace('{name}', firstName) : t('home_welcome_generic')
  // Live from the shared voucher listener: a purchase or a redemption updates the count without a reload.
  // null until the first snapshot (or if the read is refused): the card shows "–", never a fake 0.
  const activeCount = useVouchers().active?.length ?? null
  const [photoOpen, setPhotoOpen] = useState(false)

  // The shared catalog (lib/offers/offersStore.ts): a held or saved copy draws on the first frame, a stale one refreshes
  // behind it, so coming back to Home never shows a skeleton. A failed read with nothing to show is the empty state.
  const { offers: storeOffers, failed } = useOffers()
  const offers = storeOffers ?? (failed ? [] : null)

  // Near me (the bar's button) or a picked area narrows every list on Home (lib/perks/locationFilter.ts).
  const { filter, setRadiusKm, setAreaPick, setOrigin } = usePerksSearch()
  const located = useMemo(() => (offers ? applyLocationFilter(offers, filter) : null), [offers, filter])
  const locEmpty = !!filter && !!located && !located.some((o) => o.perkScope !== 'multi_chain')
  const curated = useMemo(() => (located ? selectCurated(located) : null), [located])
  const superOffers = useMemo(() => (located ? selectSuperVouchers(located) : []), [located])
  const highlights = useMemo(() => (located ? selectHighlights(located) : null), [located])
  const rails = useMemo(() => (located ? buildCategoryRails(located) : []), [located])

  return (
    <main className="member-canvas below-header min-h-[100dvh] overflow-x-clip">
      {/* No site footer for members: the support prompt is pinned to the bottom of the screen instead, clear of the iPhone home indicator. */}
      <MemberPageShell
        fluid
        globalSearch
        footer={
          <p className="text-center text-sm text-body">
            {t('home_faq_prompt_pre')}{' '}
            <Link href="/support" className="text-brand font-semibold hover:underline">
              {t('home_faq_prompt_link')}
            </Link>
          </p>
        }
      >
        <div className="mx-auto mb-4 w-full max-w-[760px] px-4 sm:px-0 lg:max-w-[1200px]">
          <LocationFilterBar filter={filter} onRadius={setRadiusKm} onClear={() => { setOrigin(null); setAreaPick(null) }} />
          {locEmpty && (
            <div className="mt-4 rounded-2xl border border-slate-100 bg-white px-5 py-6 text-center" aria-live="polite">
              <p className="text-base font-bold text-ink">{t('loc_empty_title').replace('{km}', String(filter?.kind === 'gps' ? filter.radiusKm : ''))}</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-body">{t('loc_empty_sub')}</p>
              {filter?.kind === 'gps' && filter.radiusKm < 25 && (
                <button type="button" onClick={() => setRadiusKm(filter.radiusKm === 5 ? 15 : 25)} className="mt-3 min-h-11 text-sm font-bold text-brand hover:underline">{t('loc_expand').replace('{km}', String(filter.radiusKm === 5 ? 15 : 25))}</button>
              )}
            </div>
          )}
        </div>

        <MemberColumn wide className="lg:hidden">
          {/* Phones and tablets (under 1024px): one centred hero, 16px (24px from 640px) under the search bar: the greeting row on the start edge, then the pass card (both up to 680px, so their start edges line up). From 1024px both go: My Pass is in the navbar, and a text-only welcome opens the category section below. */}
          <div className="mx-auto -mt-2 flex w-full max-w-[760px] flex-col items-center gap-5 sm:gap-6">
          <header className={`mx-auto flex w-full max-w-[680px] flex-row items-center justify-start gap-3 sm:gap-3.5 min-w-0 min-h-14 text-start ${loaded && period ? 'greet-in' : 'invisible'}`}>
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
            <div className="flex min-w-0 items-center self-center">
              <h1 id="home-welcome" className={`${PAGE_TITLE} min-w-0 line-clamp-2 break-words`}>
                {greeting}
              </h1>
            </div>
          </header>
          {photoURL && <AvatarLightbox src={photoURL} open={photoOpen} onClose={() => setPhotoOpen(false)} />}
          <div className="mx-auto w-full max-w-[680px] text-start">
            <ActivePassCard count={activeCount} className="!mt-0" />
          </div>
          </div>
        </MemberColumn>

        {/* Desktop only: a plain text welcome on the start edge, in the page-title type (PAGE_TITLE, the same as /categories), with no avatar, badge or pass card (the navbar has them). */}
        <MemberColumn wide>
          <h1 id="home-welcome-lg" className={`hidden lg:block lg:-mt-2 lg:mb-6 ${PAGE_TITLE} ${loaded && period ? 'greet-in' : 'invisible'}`}>
            {greeting}
          </h1>
        </MemberColumn>

        {/* The flagship multi-chain voucher, one card per value (100 / 150), first under the welcome and above the categories. */}
        {superOffers[0] && (
          <SectionBoundary name="home-super-tav">
            <MemberColumn wide className="mt-6 sm:mt-8 lg:mt-0"><MultiChainShowcase offer={superOffers[0]} /></MemberColumn>
          </SectionBoundary>
        )}

        <SectionBoundary name="home-category-photos">
          <section aria-labelledby="home-categories-title" className={superOffers[0] ? 'mt-8' : 'mt-6 sm:mt-8 lg:mt-0'}>
            <MemberColumn wide>
              <CategoryPhotoTitle id="home-categories-title" className="mb-3 text-xl font-bold text-ink" />
            </MemberColumn>
            <CategoryPhotoRail />
          </section>
        </SectionBoundary>

        <div className="mt-4 space-y-4 sm:mt-5 sm:space-y-5">
          <HomeDivider />
          <SectionBoundary name="home-curated"><CuratedOffers offers={curated} /></SectionBoundary>
          {/* The Perks page's two highlight rails, the same offers, each on its own beat. */}
          {highlights && highlights.newOffers.length > 0 && (
            <>
            <HomeDivider />
            <SectionBoundary name="home-new">
              <OfferCardRail
                id="home-new-title"
                title={t('row_new')}
                glyph={<Sparkles aria-hidden="true" className="h-[18px] w-[18px] flex-shrink-0 text-ink" strokeWidth={1.5} />}
                offers={highlights.newOffers}
                href="/categories/new"
                seeAll={t('home_see_all')}
                dots
                autoAdvance
                autoAdvanceOffsetMs={1500}
                compact
              />
            </SectionBoundary>
            </>
          )}
          {highlights && highlights.bestsellerOffers.length > 0 && (
            <>
            <HomeDivider />
            <SectionBoundary name="home-bestsellers">
              <OfferCardRail
                id="home-bestsellers-title"
                title={t('row_bestsellers')}
                glyph={<Award aria-hidden="true" className="h-[18px] w-[18px] flex-shrink-0 text-ink" strokeWidth={1.5} />}
                offers={highlights.bestsellerOffers}
                href="/categories/bestsellers"
                seeAll={t('home_see_all')}
                dots
                autoAdvance
                autoAdvanceOffsetMs={3000}
                compact
              />
            </SectionBoundary>
            </>
          )}
          {rails.map((rail, index) => (
            <Fragment key={rail.category}>
            <HomeDivider />
            <SectionBoundary name="home-category-rail">
              <OfferCardRail
                id={`home-rail-${index}`}
                title={railLabel(rail, t)}
                glyph={<CategoryIcon category={rail.category} className="h-[18px] w-[18px] flex-shrink-0 text-ink" strokeWidth={1.5} />}
                offers={rail.offers}
                href={rail.tile ? categoryHref(rail.tile.category) : undefined}
                seeAll={rail.tile ? t('home_see_all') : undefined}
                showCategoryBadge={false}
                compact
              />
            </SectionBoundary>
            </Fragment>
          ))}
        </div>
      </MemberPageShell>
    </main>
  )
}

/** The hairline between Home's rail blocks, inside the wide column: it fades out at both ends, so it reads the same in English and Hebrew. Decorative. */
function HomeDivider() {
  return (
    <MemberColumn wide>
      <div aria-hidden="true" data-home-divider="" className="h-px w-full bg-gradient-to-r from-transparent via-slate-200/80 to-transparent" />
    </MemberColumn>
  )
}
