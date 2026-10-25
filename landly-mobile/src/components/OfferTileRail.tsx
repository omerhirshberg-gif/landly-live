import { useMemo, useRef, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import AppText from './AppText'
import OfferTile from './OfferTile'
import { useLang } from '../i18n/LangProvider'
import { CAROUSEL_EDGE as EDGE, CAROUSEL_GAP as GAP, TILE_RAIL_WIDTH, carouselSnapOffsets } from '../lib/carousel'
import { useLayout } from '../lib/useLayout'
import { isWeb, webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// One of the Perks tab's highlight rails (New on Landly, Best Sellers,
// stacked above the category grid; web: components/discover/OfferTileRail.tsx):
// a heading, then the perks as compact OfferTiles in one row that scrolls
// sideways. A swipe settles on a card's edge with fast deceleration, as
// Home's carousel does. It bleeds through the screen's side padding (16pt on
// a phone, src/lib/layout.ts). Native snapping
// takes explicit offsets (flipped for Hebrew, where the first column sits at
// the far right); the web build snaps with CSS scroll-snap.
export default function OfferTileRail({
  emoji,
  title,
  offers,
  onOpen,
}: {
  emoji: string
  title: string
  offers: OfferDocument[]
  onOpen: (offer: OfferDocument) => void
}) {
  const { isRtl } = useLang()
  const { paddingLeft, paddingRight } = useLayout()
  const list = useRef<FlatList<OfferDocument>>(null)
  const [viewport, setViewport] = useState(0)

  const interval = TILE_RAIL_WIDTH + GAP
  const contentWidth = paddingLeft + paddingRight + offers.length * TILE_RAIL_WIDTH + Math.max(0, offers.length - 1) * GAP
  const maxOffset = Math.max(0, contentWidth - viewport)
  const snapToOffsets = useMemo(
    () => (isWeb || !viewport ? undefined : carouselSnapOffsets(offers.length, interval, maxOffset, isRtl)),
    [offers.length, interval, maxOffset, isRtl, viewport]
  )

  return (
    <View>
      <View style={styles.heading}>
        <AppText style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
          {emoji}
        </AppText>
        <AppText accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
      </View>
      <View style={[styles.frame, { marginLeft: -paddingLeft, marginRight: -paddingRight }]}>
        <FlatList
          showsVerticalScrollIndicator={false}
          ref={list}
          data={offers}
          keyExtractor={(offer) => offer.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToOffsets={snapToOffsets}
          snapToEnd={false}
          style={[styles.scroller, webOnly({ scrollPaddingLeft: paddingLeft, scrollPaddingRight: paddingRight }) as object]}
          contentContainerStyle={[styles.row, { paddingLeft, paddingRight }]}
          ItemSeparatorComponent={Separator}
          onLayout={(e) => setViewport(e.nativeEvent.layout.width)}
          // Rows lay out right-to-left in Hebrew, but a horizontal list still
          // opens at its left edge; jump to the reading-direction start.
          onContentSizeChange={() => {
            if (isRtl) list.current?.scrollToEnd({ animated: false })
          }}
          renderItem={({ item }) => (
            <View style={styles.slot}>
              <OfferTile offer={item} onPress={() => onOpen(item)} />
            </View>
          )}
        />
      </View>
    </View>
  )
}

function Separator() {
  return <View style={styles.separator} />
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  emoji: { fontSize: 18 },
  title: { flexShrink: 1, fontSize: 17, fontWeight: '700', color: colors.heading },
  frame: { marginHorizontal: -EDGE },
  // CSS-only keys react-native-web passes through; RN's style types don't know them.
  scroller: { flexGrow: 0, ...(webOnly({ scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain', scrollPaddingInline: EDGE }) as object) },
  // Vertical room so the tiles' shadows aren't clipped by the scroller.
  row: { paddingHorizontal: EDGE, paddingTop: 2, paddingBottom: 10 },
  slot: { width: TILE_RAIL_WIDTH, ...(webOnly({ scrollSnapAlign: 'start' }) as object) },
  separator: { width: GAP },
})
