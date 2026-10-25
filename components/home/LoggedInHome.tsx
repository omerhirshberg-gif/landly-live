'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { User } from 'firebase/auth'
import Avatar from '@/components/ui/Avatar'
import AvatarLightbox from '@/components/ui/AvatarLightbox'
import CategoryRail from '@/components/perks/CategoryRail'
import CuratedOffers from './CuratedOffers'
import LandlyMark from './LandlyMark'
import MemberPageShell, { PAGE_TITLE } from '@/components/layout/MemberPageShell'
import SegmentBadge from '@/components/member/SegmentBadge'
import { useMemberProfile } from '@/lib/firebase/useMemberProfile'
import { subscribeToUserVouchers } from '@/lib/firebase/vouchers'
import { useLang } from '@/lib/i18n/useLang'

// The signed-in home: the member's greeting, the blue member-pass card with
// their live active-pass count, a row of curated offers, then the categories.
// Guest marketing (hero, value props, How it works, the Aliyah card) never
// renders here. Same order as the Expo Home tab
// (landly-mobile/src/app/(tabs)/index.tsx).
//
// "Welcome, {firstName}" comes from the profile (falling back to the display
// name, never the email). The greeting row holds its space until the profile
// is read, then fades and rises in, so a fallback name never flashes first.
export default function LoggedInHome({ user }: { user: User }) {
  const { t } = useLang()
  const { loaded, profile, firstName, initials, photoURL } = useMemberProfile(user)
  // null until the first snapshot (or if the read is refused): shows "–", never a fake 0.
  const [activeCount, setActiveCount] = useState<number | null>(null)
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

  return (
    <main className="member-canvas below-header min-h-[100dvh] overflow-x-clip">
      {/* No site footer for members: the support prompt is pinned to the bottom of the screen instead, clear of the iPhone home indicator. */}
      <MemberPageShell
        footer={
          <p className="text-center text-sm text-body">
            {t('home_faq_prompt_pre')}{' '}
            <Link href="/support" className="text-brand font-semibold hover:underline">
              {t('home_faq_prompt_link')}
            </Link>
          </p>
        }
      >
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

        {/* The member pass: the page's focal point. Deep brand blue with the Expo
            card's two background layers (landly-mobile/src/app/(tabs)/index.tsx,
            passGlow and passMark), copied 1:1; the live count, then the way into
            My Pass. The whole card is one link. Hebrew mirrors it through the
            page's dir: `end` puts both layers on the left. Full width on
            phones; from md it keeps a card's proportions (576px, at least
            200px tall) at the column's start edge, the button at its foot. */}
        <Link
          href="/member"
          aria-labelledby="home-pass-count home-pass-cta"
          className="group relative isolate mt-5 sm:mt-6 flex w-full flex-col fold:max-w-xl md:min-h-[200px] overflow-hidden rounded-2xl bg-[#0038B8] p-5 sm:p-6 md:px-8 md:py-7 text-white shadow-[0_12px_32px_-12px_rgba(0,42,138,0.55)] [-webkit-tap-highlight-color:transparent] transition-transform duration-150 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {/* passGlow: a 200px disc of 8% white, bleeding off the top end corner
              (top -70, end -50) and clipped by the card's overflow-hidden. */}
          <span aria-hidden="true" className="pointer-events-none absolute -top-[70px] -end-[50px] z-0 h-[200px] w-[200px] rounded-full bg-white/[0.08]" />
          {/* passMark: the emblem, 88x86 at top 12, end 14, every path white at 15%. */}
          <LandlyMark className="pointer-events-none absolute top-3 end-3.5 z-0 h-[86px] w-[88px] text-white/15" />
          <span className="relative z-10 flex items-center gap-2.5">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/15" aria-hidden="true">
              <i className="fa-solid fa-ticket text-base"></i>
            </span>
            <span className="text-[13px] font-bold uppercase tracking-wide text-white/85">{t('home_pass_label')}</span>
          </span>
          <span id="home-pass-count" className="relative z-10 mt-4 md:mb-5 flex items-center gap-3 sm:gap-4 pe-[72px]">
            <span className="text-[44px] sm:text-5xl leading-none font-extrabold tabular-nums" dir="ltr" aria-live="polite">{activeCount ?? '–'}</span>
            <span className="min-w-0 text-[15px] sm:text-base font-semibold leading-snug">
              {t('home_vouchers_message').replace('{count}', String(activeCount ?? 0))}
            </span>
          </span>
          <span id="home-pass-cta" className="relative z-10 mt-5 md:mt-auto flex h-12 w-full sm:w-auto sm:self-start sm:inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 text-[15px] font-bold text-brand transition-colors [@media(hover:hover)]:group-hover:bg-brandLight">
            <span>{t('home_pass_cta')}</span>
            <i className="fa-solid fa-arrow-right text-xs rtl:-scale-x-100" aria-hidden="true"></i>
          </span>
        </Link>

        <div className="mt-8 lg:mt-10">
          <CuratedOffers showWishlistButton />
        </div>

        <section className="mt-8 lg:mt-10" aria-labelledby="home-deals-title">
          <h2 id="home-deals-title" className="text-xl font-bold text-ink mb-4">{t('home_deals_title')}</h2>
          <CategoryRail />
        </section>
      </MemberPageShell>
    </main>
  )
}
