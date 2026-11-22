'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { User } from 'firebase/auth'
import Avatar from '@/components/ui/Avatar'
import AvatarLightbox from '@/components/ui/AvatarLightbox'
import ActivePassCard from './ActivePassCard'
import HomeCategoryRails from './HomeCategoryRails'
import RaayonitPromoStrip from '@/components/raayonit/RaayonitPromoStrip'
import SectionBoundary from '@/components/errors/SectionBoundary'
import { useRaayonitDisplay } from '@/lib/flags/raayonitDisplayStore'
import { isFlagship, isRaayonitOffer, landlyOffers } from '@/lib/offers/discoverTab'
import MemberPageShell, { MemberColumn, PAGE_TITLE } from '@/components/layout/MemberPageShell'
import LocationFilterBar from '@/components/discover/LocationFilterBar'
import { usePerksSearch } from '@/lib/perks/PerksSearchProvider'
import { applyLocationFilter } from '@/lib/perks/locationFilter'
import { useOffers } from '@/lib/offers/useOffers'
import { useMemberProfile } from '@/lib/firebase/useMemberProfile'
import { useVouchers } from '@/lib/firebase/VouchersProvider'
import { greetingKey } from '@/lib/auth/greeting'
import { useGreetingPeriod } from '@/lib/home/useGreetingPeriod'
import { useLang } from '@/lib/i18n/useLang'

// The signed-in home: the member's greeting, the blue member-pass card with
// their live active-pass count, then a row for every GoLandly category with ten
// slots (HomeCategoryRails; lib/home/categoryRails.ts buildHomeCategorySlots):
// real perks first, "Coming soon" placeholders after. No Raayonit here. The greeting, card and rails
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
  // Home shows GoLandly's own perks only (plus one entry banner to the Raayonit Card tab); Raayonit's "תו על" has its own tab (/raayonit).
  const allLocated = useMemo(() => (offers ? applyLocationFilter(offers, filter) : null), [offers, filter])
  const located = useMemo(() => (allLocated ? landlyOffers(allLocated) : null), [allLocated])
  const raayonitOffers = useMemo(() => (offers ?? []).filter(isRaayonitOffer), [offers])
  const flagship = useMemo(() => raayonitOffers.find(isFlagship) ?? null, [raayonitOffers])
  const chainCount = useMemo(() => raayonitOffers.filter((o) => !isFlagship(o)).length, [raayonitOffers])
  // The entry banner to the Raayonit Card tab: there while the tab is (Raayonit's name may be shown).
  const showBanner = useRaayonitDisplay()
  const locEmpty = !!filter && !!located && !located.some((o) => o.perkScope !== 'multi_chain')

  return (
    <main className="member-canvas below-header min-h-[100dvh] overflow-x-clip">
      {/* No site footer for members: the support prompt is pinned to the bottom of the screen instead, clear of the iPhone home indicator. */}
      <MemberPageShell
        fluid
        contained
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

        {/* Every official GoLandly category as a row of ten cards: real perks first, "Coming soon" placeholders after. Raayonit has its own tab (/raayonit) and never appears here. */}
        {showBanner && (
          <SectionBoundary name="home-raayonit-banner">
            <MemberColumn wide className="mt-6 sm:mt-8 lg:mt-0"><RaayonitPromoStrip offer={flagship} count={chainCount} /></MemberColumn>
          </SectionBoundary>
        )}
        <div className="mb-8 mt-6 sm:mt-8 lg:mt-6">
          <HomeCategoryRails offers={located} />
        </div>
      </MemberPageShell>
    </main>
  )
}
