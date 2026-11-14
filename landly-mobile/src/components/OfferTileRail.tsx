import { StyleSheet, View } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import AppText from './AppText'
import OfferCarousel from './OfferCarousel'
import { RAIL_ICONS, type RailGlyph } from '../lib/categoryGlyphs'
import { colors } from '../theme'
import LineIcon from './LineIcon'

// One of the Perks tab's highlight rails (New on GoLandly, Best Sellers,
// stacked above the category grid; web: components/discover/OfferTileRail.tsx):
// a heading led by a bare 18pt line icon at 1.5 stroke, no frame (RAIL_ICONS:
// Sparkles for New, Award for Best Sellers), then the perks as Home's carousel
// draws them (OfferCarousel.tsx): the same compact cards about 72% of the screen
// wide, settling on a card's edge, with page dots underneath. It bleeds
// through the screen's side padding and mirrors in Hebrew as Home's does.
export default function OfferTileRail({
  glyph,
  title,
  offers,
  onOpen,
  autoAdvance = false,
  autoAdvanceOffsetMs = 0,
}: {
  glyph: RailGlyph
  title: string
  offers: OfferDocument[]
  onOpen: (offer: OfferDocument) => void
  /** Moves on every 5 seconds; the offset staggers it from the rail beside it. */
  autoAdvance?: boolean
  autoAdvanceOffsetMs?: number
}) {
  return (
    <View>
      <View style={styles.heading}>
        <LineIcon name={RAIL_ICONS[glyph]} size={18} color={colors.textStrong} strokeWidth={1.5} />
        <AppText accessibilityRole="header" style={styles.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
          {title}
        </AppText>
      </View>
      <OfferCarousel offers={offers} onOpen={onOpen} autoAdvance={autoAdvance} autoAdvanceOffsetMs={autoAdvanceOffsetMs} />
    </View>
  )
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  title: { flexShrink: 1, fontSize: 17, fontWeight: '700', color: colors.heading },
})
