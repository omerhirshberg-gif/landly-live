import { StyleSheet, View } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import AppText from './AppText'
import Emoji from './Emoji'
import OfferCarousel from './OfferCarousel'
import { RAIL_GLYPHS, type RailGlyph } from '../lib/categoryGlyphs'
import { colors } from '../theme'

// One of the Perks tab's highlight rails (New on Landly, Best Sellers,
// stacked above the category grid; web: components/discover/OfferTileRail.tsx):
// a heading led by its emoji in a 40pt hairline frame (the web's IconFrame;
// RAIL_GLYPHS: "NEW" for New, a flame for Best Sellers), then the perks as Home's carousel draws
// them (OfferCarousel.tsx): the same compact cards about 72% of the screen
// wide, settling on a card's edge, with page dots underneath. It bleeds
// through the screen's side padding and mirrors in Hebrew as Home's does.
export default function OfferTileRail({
  glyph,
  title,
  offers,
  onOpen,
}: {
  glyph: RailGlyph
  title: string
  offers: OfferDocument[]
  onOpen: (offer: OfferDocument) => void
}) {
  return (
    <View>
      <View style={styles.heading}>
        <View style={styles.iconFrame}>
          <Emoji glyph={RAIL_GLYPHS[glyph]} size={20} />
        </View>
        <AppText accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
      </View>
      <OfferCarousel offers={offers} onOpen={onOpen} />
    </View>
  )
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  // The web IconFrame's brand tone: sky-200/60 hairline on the brand tint, 12pt corners.
  iconFrame: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(186, 230, 253, 0.6)',
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flexShrink: 1, fontSize: 17, fontWeight: '700', color: colors.heading },
})
