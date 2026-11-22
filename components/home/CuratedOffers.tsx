'use client'

import OfferCardRail from '@/components/discover/OfferCardRail'
import { MemberColumn } from '@/components/layout/MemberPageShell'
import { OfferRailSkeleton } from '@/components/ui/Skeleton'
import type { OfferDocument } from '@/lib/firebase/offers'
import { useLang } from '@/lib/i18n/useLang'

// "Recommended for you" on the members' home: the featured offers (selectCurated,
// from Home's one fetch) in a rail that moves on by itself every 5 seconds (lib/useAutoAdvance.ts), with "See all" into /categories. `offers`
// is null until that fetch answers.
export default function CuratedOffers({ offers, title }: { offers: OfferDocument[] | null; title?: string }) {
  const { t } = useLang()
  const heading = title ?? t('home_curated_title')

  if (offers && offers.length > 0) {
    return <OfferCardRail id="home-curated-title" title={heading} offers={offers} href="/categories" seeAll={t('perk_see_all_perks')} dots autoAdvance compact priorityCount={2} />
  }

  return (
    <section aria-labelledby="home-curated-title">
      <MemberColumn wide className="mb-3">
        <h2 id="home-curated-title" className="text-xl font-bold text-ink">{heading}</h2>
      </MemberColumn>
      {offers === null ? (
        <OfferRailSkeleton />
      ) : (
        <MemberColumn wide>
          <div className="bg-white border border-line rounded-2xl p-6 text-center">
            <p className="font-bold text-ink mb-1">{t('deals_empty_title')}</p>
            <p className="text-sm text-body">{t('deals_empty_sub')}</p>
          </div>
        </MemberColumn>
      )}
    </section>
  )
}
