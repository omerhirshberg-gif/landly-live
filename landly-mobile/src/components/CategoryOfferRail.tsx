import { railLabel, type CategoryRailGroup } from '@shared/home/categoryRails'
import OfferCarousel from './OfferCarousel'
import SectionHeader from './SectionHeader'
import { useLang } from '../i18n/LangProvider'
import { openOffer } from '../lib/openOffer'
import CategoryIcon from './CategoryIcon'
import { colors } from '../theme'

// One of Home's category rails (web: components/discover/OfferCardRail.tsx): its
// glyph and name, the deal count beside it, a "See all" pill, then the perks in
// Home's carousel, which keeps snapToOffsets so a swipe settles on a card in
// Hebrew too. Every card here is in the rail's own category, so none repeats it.
// A category outside the official list has no screen to open, so it passes no
// `onSeeAll`.
export default function CategoryOfferRail({ rail, onSeeAll }: { rail: CategoryRailGroup; onSeeAll?: () => void }) {
  const { t } = useLang()
  return (
    <>
      <SectionHeader
        leading={<CategoryIcon category={rail.category} size={18} strokeWidth={1.5} color={colors.brand} />}
        title={railLabel(rail, t)}
        count={rail.total}
        action={onSeeAll ? t('home_see_all') : undefined}
        onAction={onSeeAll}
      />
      <OfferCarousel offers={rail.offers} onOpen={openOffer} showDots={false} showCategoryBadge={false} />
    </>
  )
}
