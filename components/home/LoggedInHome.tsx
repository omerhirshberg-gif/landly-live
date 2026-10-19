'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { User } from 'firebase/auth'
import Avatar from '@/components/ui/Avatar'
import AvatarLightbox from '@/components/ui/AvatarLightbox'
import CategoryRail from '@/components/perks/CategoryRail'
import CuratedOffers from './CuratedOffers'
import SegmentBadge from '@/components/member/SegmentBadge'
import { useMemberProfile } from '@/lib/firebase/useMemberProfile'
import { subscribeToUserVouchers } from '@/lib/firebase/vouchers'
import { useLang } from '@/lib/i18n/useLang'

// The signed-in home: the member's greeting, their live active-pass count,
// the categories, and a row of curated offers. Guest marketing (hero, value
// props, How it works, the Aliyah card) never renders here. Same sections as
// the Expo Home tab (landly-mobile/src/app/(tabs)/index.tsx), less its
// Explore card: on the web the navbar carries Explore Perks.
//
// The greeting, persona and pass count share one banner. "Welcome,
// {firstName}" comes from the profile (falling back to the display
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
    <main className="member-canvas below-header">
      {/* No footer for members: the bottom padding clears the iPhone home indicator instead. */}
      <div className="max-w-member mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 lg:pt-12 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {/* One white banner: who the member is on the leading side, their live
            pass count and the way into My Pass on the trailing side. A row from
            md; on phones it stacks, the count and the button sharing the last
            line (the button drops under the count when that line is too narrow).
            Explore lives in the navbar and the rails below, so nothing
            here repeats it. Hebrew mirrors it through the page's dir. */}
        <section aria-labelledby="home-welcome" className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 sm:p-6 lg:p-7 flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
          <div className={`flex items-center gap-3 sm:gap-4 min-w-0 min-h-14 ${loaded ? 'greet-in' : 'invisible'}`}>
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
              <h1 id="home-welcome" className="text-[26px] sm:text-[28px] lg:text-3xl leading-tight font-bold text-ink truncate">
                {firstName ? t('home_welcome').replace('{name}', firstName) : t('home_welcome_generic')}
              </h1>
              <div className="mt-1.5">
                <SegmentBadge customerType={profile?.customerType} customerTypeOther={profile?.customerTypeOther} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:flex-col md:flex-nowrap md:items-end md:gap-2.5 flex-shrink-0">
            <span className="inline-flex items-center gap-2 h-11 md:h-9 px-3.5 rounded-full bg-brandLight text-brand text-sm font-semibold whitespace-nowrap">
              <i className="fa-solid fa-ticket text-xs" aria-hidden="true"></i>
              <span className="text-base font-bold tabular-nums" aria-live="polite">{activeCount ?? '–'}</span>
              <span>{t('home_pass_label')}</span>
            </span>
            <Link href="/member" className="ds-btn ds-btn-primary ds-btn-md flex-1 basis-40 md:flex-none md:basis-auto">
              <span>{t('home_pass_cta')}</span>
              <i className="fa-solid fa-arrow-right text-xs rtl:-scale-x-100" aria-hidden="true"></i>
            </Link>
          </div>
        </section>
        {photoURL && <AvatarLightbox src={photoURL} open={photoOpen} onClose={() => setPhotoOpen(false)} />}

        <section className="mt-8 lg:mt-10" aria-labelledby="home-deals-title">
          <h2 id="home-deals-title" className="text-xl font-bold text-ink mb-4">{t('home_deals_title')}</h2>
          <CategoryRail />
        </section>

        <div className="mt-10">
          <CuratedOffers showWishlistButton />
        </div>

        <p className="mt-12 text-center text-sm text-body">
          {t('home_faq_prompt_pre')}{' '}
          <Link href="/support" className="text-brand font-semibold hover:underline">
            {t('home_faq_prompt_link')}
          </Link>
        </p>
      </div>
    </main>
  )
}
