import { memo } from 'react'
import { railLabel, type CategoryRailGroup } from '@shared/home/categoryRails'
import OfferCarousel from './OfferCarousel'
import SectionHeader from './SectionHeader'
import { useLang } from '../i18n/LangProvider'
import { openOffer } from '../lib/openOffer'
import CategoryIcon from './CategoryIcon'
import { colors } from '../theme'

// One of Home's category rails (web: components/discover/OfferCardRail.tsx): its
// glyph and name, a "See all" pill, then the perks in
// Home's carousel, which keeps snapToOffsets so a swipe settles on a card in
// Hebrew too. Every card here is in the rail's own category, so none repeats it.
// A category outside the official list has no screen to open, so it passes no
// `onSeeAll`.
export default memo(function CategoryOfferRail({
  rail,
  onSeeAll,
  withCount = false,
  visible = true,
}: {
  rail: CategoryRailGroup
  /** Opens the category; called with the rail's category, so a screen passes one stable function to every rail. */
  onSeeAll?: (category: string) => void
  /** "See all (N)": the Perks tab's rails state how many the category holds. */
  withCount?: boolean
  /** False while scrolled out of view. */
  visible?: boolean
}) {
  const { t } = useLang()
  return (
    <>
      <SectionHeader
        leading={<CategoryIcon category={rail.category} size={18} strokeWidth={1.5} color={colors.textStrong} />}
        title={railLabel(rail, t)}
        action={onSeeAll ? (withCount ? t('cats_see_all').replace('{count}', String(rail.total)) : t('perk_see_all_perks')) : undefined}
        onAction={onSeeAll ? () => onSeeAll(rail.category) : undefined}
      />
      <OfferCarousel offers={rail.offers} onOpen={openOffer} showDots={false} showCategoryBadge={false} visible={visible} />
    </>
  )
})
