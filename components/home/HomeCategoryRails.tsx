'use client'

import OfferCardRail from '@/components/discover/OfferCardRail'
import SectionBoundary from '@/components/errors/SectionBoundary'
import CategoryIcon from '@/components/ui/CategoryIcon'
import { OfferRailSkeleton } from '@/components/ui/Skeleton'
import { MemberColumn } from '@/components/layout/MemberPageShell'
import type { OfferDocument } from '@/lib/firebase/offers'
import { buildHomeCategorySlots, homeIsEmpty } from '@/lib/home/categoryRails'
import { isChain } from '@/lib/offers/discoverTab'
import { selectChainsPreview } from '@/lib/home/chainsPreview'
import CategoryPhotoRail, { CategoryPhotoTitle } from '@/components/home/CategoryPhotoRail'
import LiveChainsSection from '@/components/perks/LiveChainsSection'
import PerksSoonCard from '@/components/perks/PerksSoonCard'
import { useLang } from '@/lib/i18n/useLang'
import { categoryHref } from '@/lib/perks/perksFilter'
import { useMemo } from 'react'

// Home's body: one row for every official GoLandly category (lib/categories.ts), each with ten
// cards: the category's claimable GoLandly perks first, "Coming soon" placeholders after, so a
// published perk takes a placeholder's place by itself. `offers` is GoLandly's own list (landlyOffers),
// never Raayonit's, which lives in its own tab. null until the catalogue answers.
// Same rows as the Expo Home tab (landly-mobile/src/app/(tabs)/index.tsx).
export default function HomeCategoryRails({ offers, chains = [], showChains = false }: { offers: OfferDocument[] | null; /** Raayonit's chains, for the live section shown while there is no direct perk. */ chains?: OfferDocument[]; showChains?: boolean }) {
  const { t, lang } = useLang()
  const chainsPreview = useMemo(() => selectChainsPreview(chains, lang), [chains, lang])
  const groups = useMemo(() => (offers ? buildHomeCategorySlots(offers) : null), [offers])

  if (!groups) {
    return (
      <MemberColumn wide>
        <OfferRailSkeleton />
      </MemberColumn>
    )
  }

  // No direct perk yet: the category photo rail, one calm note and a preview of the Raayonit chains, instead of 13 rows of placeholders.
  if (homeIsEmpty(groups)) {
    const live = showChains && chainsPreview.length > 0
    return (
      <div className="space-y-6 sm:space-y-8">
        {live && <LiveChainsSection offers={chainsPreview} chainCount={chains.filter(isChain).length} card />}
        <section aria-labelledby="home-top-categories">
          <MemberColumn wide><CategoryPhotoTitle id="home-top-categories" className="mb-3 text-xl font-bold tracking-tight text-ink" /></MemberColumn>
          <CategoryPhotoRail />
        </section>
        <MemberColumn wide><PerksSoonCard quiet={live} /></MemberColumn>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {groups.filter(({ slots }) => slots.some((s) => s.kind === 'offer')).map(({ tile, slots }, index) => {
        const real = slots.flatMap((s) => (s.kind === 'offer' ? [s.offer] : []))
        const id = `home-cat-${tile.photo}`
        return (
          <SectionBoundary key={tile.category} name={id}>
            <OfferCardRail
              id={id}
              title={t(tile.labelKey)}
              glyph={<CategoryIcon category={tile.category} className="h-[18px] w-[18px] text-ink" strokeWidth={1.5} />}
              offers={real}
              href={categoryHref(tile.category)}
              seeAll={t('perk_see_all_perks')}
              showCategoryBadge={false}
              compact
              scaled
              priorityCount={index === 0 ? 2 : 0}
            />
          </SectionBoundary>
        )
      })}
    </div>
  )
}
