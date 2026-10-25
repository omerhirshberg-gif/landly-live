import { useMemo, useRef, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import OfferCard from './OfferCard'
import { useLang } from '../i18n/LangProvider'
import { CAROUSEL_EDGE as EDGE, CAROUSEL_GAP as GAP, carouselCardWidth, carouselSnapOffsets } from '../lib/carousel'
import { useLayout } from '../lib/useLayout'
import { isWeb, webOnly } from '../lib/webStyles'

// Home's "Curated for you" row (web: the rail in components/home/LoggedInHome.tsx):
// compact cards about 72% of the screen wide that settle on a card's edge, with
// fast deceleration so a flick moves on a card or two rather than coasting.
// Native snapping takes explicit offsets; the web build snaps with CSS
// scroll-snap, which handles right-to-left on its own. It bleeds through the
// screen's side padding, whatever the fold makes it (src/lib/layout.ts).
export default function OfferCarousel({ offers, onOpen }: { offers: OfferDocument[]; onOpen: (offer: OfferDocument) => void }) {
  const { isRtl } = useLang()
  const { width: screenWidth, paddingLeft, paddingRight } = useLayout()
  const list = useRef<FlatList<OfferDocument>>(null)
  const [viewport, setViewport] = useState(0)

  const cardWidth = carouselCardWidth(screenWidth)
  const interval = cardWidth + GAP
  const contentWidth = paddingLeft + paddingRight + offers.length * cardWidth + Math.max(0, offers.length - 1) * GAP
  const maxOffset = Math.max(0, contentWidth - viewport)
  const snapToOffsets = useMemo(
    () => (isWeb || !viewport ? undefined : carouselSnapOffsets(offers.length, interval, maxOffset, isRtl)),
    [offers.length, interval, maxOffset, isRtl, viewport]
  )

  return (
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
          <View style={[styles.slot, { width: cardWidth }]}>
            <OfferCard offer={item} variant="carousel" onPress={() => onOpen(item)} />
          </View>
        )}
      />
    </View>
  )
}

function Separator() {
  return <View style={styles.separator} />
}

const styles = StyleSheet.create({
  frame: { marginHorizontal: -EDGE },
  // CSS-only keys react-native-web passes through; RN's style types don't know them.
  scroller: { flexGrow: 0, ...(webOnly({ scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain', scrollPaddingInline: EDGE }) as object) },
  // Vertical room so the cards' shadows aren't clipped by the scroller.
  row: { paddingHorizontal: EDGE, paddingTop: 2, paddingBottom: 10 },
  slot: { ...(webOnly({ scrollSnapAlign: 'start' }) as object) },
  separator: { width: GAP },
})
