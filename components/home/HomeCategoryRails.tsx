'use client'

import OfferCardRail from '@/components/discover/OfferCardRail'
import SectionBoundary from '@/components/errors/SectionBoundary'
import CategoryIcon from '@/components/ui/CategoryIcon'
import { OfferRailSkeleton } from '@/components/ui/Skeleton'
import { MemberColumn } from '@/components/layout/MemberPageShell'
import type { OfferDocument } from '@/lib/firebase/offers'
import { buildHomeCategorySlots, HOME_SLOT_COUNT } from '@/lib/home/categoryRails'
import { useLang } from '@/lib/i18n/useLang'
import { categoryHref } from '@/lib/perks/perksFilter'
import { useMemo } from 'react'

// Home's body: one row for every official GoLandly category (lib/categories.ts), each with ten
// cards: the category's claimable GoLandly perks first, "Coming soon" placeholders after, so a
// published perk takes a placeholder's place by itself. `offers` is GoLandly's own list (landlyOffers),
// never Raayonit's, which lives in its own tab. null until the catalogue answers.
// Same rows as the Expo Home tab (landly-mobile/src/app/(tabs)/index.tsx).
export default function HomeCategoryRails({ offers }: { offers: OfferDocument[] | null }) {
  const { t } = useLang()
  const groups = useMemo(() => (offers ? buildHomeCategorySlots(offers) : null), [offers])

  if (!groups) {
    return (
      <MemberColumn wide>
        <OfferRailSkeleton />
      </MemberColumn>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {groups.map(({ tile, slots }, index) => {
        const real = slots.flatMap((s) => (s.kind === 'offer' ? [s.offer] : []))
        const id = `home-cat-${tile.photo}`
        return (
          <SectionBoundary key={tile.category} name={id}>
            <OfferCardRail
              id={id}
              title={t(tile.labelKey)}
              glyph={<CategoryIcon category={tile.category} className="h-[18px] w-[18px] text-ink" strokeWidth={1.5} />}
              offers={real}
              placeholders={HOME_SLOT_COUNT - real.length}
              href={categoryHref(tile.category)}
              seeAll={t('perk_see_all_perks')}
              showCategoryBadge={false}
              compact
              priorityCount={index === 0 ? 2 : 0}
            />
          </SectionBoundary>
        )
      })}
    </div>
  )
}
