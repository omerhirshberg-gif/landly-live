import { memo } from 'react'
import { View } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import SectionHeader from './SectionHeader'
import OfferCarousel from './OfferCarousel'
import { RAIL_ICONS, type RailGlyph } from '../lib/categoryGlyphs'
import { colors } from '../theme'
import LineIcon from './LineIcon'

// One of the Perks tab's highlight rails (New on GoLandly, Best Sellers,
// stacked above the category grid; web: components/discover/OfferTileRail.tsx):
// a SectionHeader (the same title type, icon slot and reading-direction alignment as Home's category rails) led by a bare 18pt line icon at 1.5 stroke, no frame (RAIL_ICONS:
// Sparkles for New, Award for Best Sellers), then the perks as Home's carousel
// draws them (OfferCarousel.tsx): the same compact cards about 72% of the screen
// wide, settling on a card's edge, with page dots underneath. It bleeds
// through the screen's side padding and mirrors in Hebrew as Home's does.
export default memo(function OfferTileRail({
  glyph,
  title,
  offers,
  onOpen,
  autoAdvance = false,
  autoAdvanceOffsetMs = 0,
  visible = true,
}: {
  glyph: RailGlyph
  title: string
  offers: OfferDocument[]
  onOpen: (offer: OfferDocument) => void
  /** Moves on every 5 seconds; the offset staggers it from the rail beside it. */
  autoAdvance?: boolean
  autoAdvanceOffsetMs?: number
  /** False while scrolled out of view: the autoplay holds still. */
  visible?: boolean
}) {
  return (
    <View>
      <SectionHeader leading={<LineIcon name={RAIL_ICONS[glyph]} size={18} color={colors.textStrong} strokeWidth={1.5} />} title={title} />
      <OfferCarousel offers={offers} onOpen={onOpen} autoAdvance={autoAdvance} autoAdvanceOffsetMs={autoAdvanceOffsetMs} visible={visible} />
    </View>
  )
})

