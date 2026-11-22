import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Platform, StyleSheet, View, type ListRenderItem } from 'react-native'
import { useFocusEffect } from 'expo-router'
import Animated, { useAnimatedScrollHandler, useReducedMotion, useSharedValue } from 'react-native-reanimated'
import type { OfferDocument } from '@shared/firebase/offers'
import { AUTO_ADVANCE_MS, nextAutoIndex } from '@shared/carouselAutoplay'
import OfferCard from './OfferCard'
import OfferCardPlaceholder from './OfferCardPlaceholder'
import PagerDots from './PagerDots'
import { useLang } from '../i18n/LangProvider'
import { CAROUSEL_EDGE as EDGE, CAROUSEL_GAP as GAP, PAGER_DOTS_MAX, carouselCardWidth, carouselInitialCount, carouselItemLayout, carouselPage, carouselSnapOffsets } from '../lib/carousel'
import { useAppActive } from '../lib/useAppActive'
import { useLayout } from '../lib/useLayout'
import { isWeb, webOnly } from '../lib/webStyles'

// Home's "Curated for you" row (web: the rail in components/home/LoggedInHome.tsx):
// compact cards about 72% of the screen wide that settle on a card's edge, with
// fast deceleration so a flick moves on a card or two rather than coasting.
// Native snapping takes explicit offsets; the web build snaps with CSS
// scroll-snap, which handles right-to-left on its own. It bleeds through the
// screen's side padding, whatever the fold makes it (src/lib/layout.ts).
// Pagination dots underneath (PagerDots) follow the swipe, one per place the
// row can come to rest; Home's category rails go without (`showDots`).
//
// Windowed: left to right, every card's place is known up front
// (carouselItemLayout), so the row mounts only the cards in view plus the next
// and adds the rest as it scrolls. In Hebrew the row lays out right to left
// through the root view's `direction`, which the list's windowing doesn't see
// (it only knows I18nManager, kept left-to-right), so there it mounts its whole
// row -- at most RAIL_MAX cards -- rather than risk a blank cell; the screen's
// own list still mounts only the rails near the viewport.
type Placeholder = { placeholder: true; id: string }
type CarouselItem = OfferDocument | Placeholder

export default memo(function OfferCarousel({
  offers,
  onOpen,
  showDots = true,
  showCategoryBadge = true,
  autoAdvance = false,
  autoAdvanceOffsetMs = 0,
  visible = true,
  placeholders = 0,
}: {
  offers: OfferDocument[]
  onOpen: (offer: OfferDocument) => void
  showDots?: boolean
  /** Off in a rail already scoped to one category, where every card would repeat it. */
  showCategoryBadge?: boolean
  /** Moves on to the next card every 5 seconds, then back to the first; Home's curated row only. */
  autoAdvance?: boolean
  /** Added to the first wait, so two rails on one screen never move on the same beat. */
  autoAdvanceOffsetMs?: number
  /** False while the rail is scrolled out of view: its autoplay holds still. */
  visible?: boolean
  /** Inert "Coming soon" cards after the offers (Home's category rows pad to ten). */
  placeholders?: number
}) {
  const { isRtl } = useLang()
  const { width: screenWidth, paddingLeft, paddingRight } = useLayout()
  const data = useMemo<CarouselItem[]>(
    () => (placeholders > 0 ? [...offers, ...Array.from({ length: placeholders }, (_, i): Placeholder => ({ placeholder: true, id: `ph:${i}` }))] : offers),
    [offers, placeholders]
  )
  const list = useRef<FlatList<CarouselItem>>(null)
  const [viewport, setViewport] = useState(0)

  const cardWidth = carouselCardWidth(screenWidth)
  const interval = cardWidth + GAP
  const contentWidth = paddingLeft + paddingRight + data.length * cardWidth + Math.max(0, data.length - 1) * GAP
  const maxOffset = Math.max(0, contentWidth - viewport)
  const snapToOffsets = useMemo(
    () => (isWeb || !viewport ? undefined : carouselSnapOffsets(data.length, interval, maxOffset, isRtl)),
    [data.length, interval, maxOffset, isRtl, viewport]
  )
  // The resting places counted from the start edge, whichever way the row reads.
  const starts = useMemo(() => (viewport ? carouselSnapOffsets(data.length, interval, maxOffset, false) : []), [data.length, interval, maxOffset, viewport])
  const reduced = useReducedMotion()
  const position = useSharedValue(0)
  // contentOffset.x counts from the left on native (so from the far end in
  // Hebrew) and, on the web build, negative from the right in Hebrew.
  const onScroll = useAnimatedScrollHandler((e) => {
    const x = e.contentOffset.x
    position.set(carouselPage(isWeb ? Math.abs(x) : isRtl ? maxOffset - x : x, starts))
  })
  const goTo = (i: number) => {
    const fromStart = starts[i] ?? 0
    const offset = !isRtl ? fromStart : isWeb ? -fromStart : maxOffset - fromStart
    list.current?.scrollToOffset({ offset, animated: !reduced })
  }

  // Auto-advance (lib/carouselAutoplay.ts): holds still while a finger is on the row
  // (from the drag's start until its momentum settles), while the screen is blurred or
  // the app is in the background, and under Reduce Motion; every hold restarts the full 5s.
  const [dragging, setDragging] = useState(false)
  const [focused, setFocused] = useState(true)
  const appActive = useAppActive()
  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      return () => setFocused(false)
    }, [])
  )
  const count = starts.length
  const running = autoAdvance && visible && !reduced && !dragging && focused && appActive && count > 1
  useEffect(() => {
    if (!running) return
    // The dots' own position (UI thread value, in resting places) says where the row is, by hand or by timer.
    const step = () => goTo(nextAutoIndex(position.get(), count))
    let timer: ReturnType<typeof setInterval> | undefined
    const first = setTimeout(() => {
      step()
      timer = setInterval(step, AUTO_ADVANCE_MS)
    }, AUTO_ADVANCE_MS + autoAdvanceOffsetMs)
    return () => {
      clearTimeout(first)
      if (timer) clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, count, isRtl, maxOffset, autoAdvanceOffsetMs])

  // Hebrew opens at the reading-direction start (the far end of the scroll), once, when the row first has its size.
  const openedAtStart = useRef(false)
  const windowed = !isRtl
  const getItemLayout = useCallback(
    (_: ArrayLike<CarouselItem> | null | undefined, index: number) => carouselItemLayout(index, data.length, cardWidth, GAP, paddingLeft),
    [data.length, cardWidth, paddingLeft]
  )
  const renderItem = useCallback<ListRenderItem<CarouselItem>>(
    ({ item }) => (
      <View style={[styles.slot, { width: cardWidth }]}>
        {'placeholder' in item ? (
          <OfferCardPlaceholder width={cardWidth} />
        ) : (
          <OfferCard offer={item} variant="carousel" width={cardWidth} onOpen={onOpen} showCategoryBadge={showCategoryBadge} />
        )}
      </View>
    ),
    [cardWidth, onOpen, showCategoryBadge]
  )
  const initialCount = carouselInitialCount(viewport || screenWidth, cardWidth, data.length)

  return (
    <View style={[styles.frame, { marginLeft: -paddingLeft, marginRight: -paddingRight }]}>
      <Animated.FlatList
        showsVerticalScrollIndicator={false}
        ref={list}
        data={data}
        keyExtractor={(offer) => offer.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToOffsets={snapToOffsets}
        snapToEnd={false}
        onScroll={onScroll}
        onScrollBeginDrag={() => setDragging(true)}
        // A flick carries on to its momentum end, which hands the row back; a drag that stops dead hands it back at its end.
        onScrollEndDrag={(e) => {
          if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.05) setDragging(false)
        }}
        onMomentumScrollEnd={() => setDragging(false)}
        scrollEventThrottle={16}
        style={[styles.scroller, webOnly({ scrollPaddingLeft: paddingLeft, scrollPaddingRight: paddingRight }) as object]}
        contentContainerStyle={[styles.row, { paddingLeft, paddingRight }]}
        ItemSeparatorComponent={Separator}
        onLayout={(e) => setViewport(e.nativeEvent.layout.width)}
        // Rows lay out right-to-left in Hebrew, but a horizontal list still
        // opens at its left edge; jump to the reading-direction start, once.
        onContentSizeChange={(width) => {
          if (!isRtl || openedAtStart.current || width <= 0) return
          openedAtStart.current = true
          list.current?.scrollToEnd({ animated: false })
        }}
        getItemLayout={windowed ? getItemLayout : undefined}
        initialNumToRender={windowed ? initialCount : data.length}
        maxToRenderPerBatch={windowed ? 2 : data.length}
        windowSize={windowed ? 3 : 21}
        removeClippedSubviews={windowed && Platform.OS === 'android'}
        renderItem={renderItem}
      />
      {showDots && starts.length > 1 && starts.length <= PAGER_DOTS_MAX && <PagerDots count={starts.length} position={position} onSelect={goTo} />}
    </View>
  )
})

function Separator() {
  return <View style={styles.separator} />
}

const styles = StyleSheet.create({
  frame: { marginHorizontal: -EDGE },
  // CSS-only keys react-native-web passes through; RN's style types don't know them.
  scroller: { flexGrow: 0, ...(webOnly({ scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain', scrollPaddingInline: EDGE }) as object) },
  // Vertical room so the cards' shadows aren't clipped by the scroller.
  row: { paddingHorizontal: EDGE, paddingTop: 2, paddingBottom: 10 },
  // The row stretches its slots to the tallest card, and each card fills its slot (OfferCard's
  // `fill`), so prices line up along the foot without reserving empty title lines.
  slot: { ...(webOnly({ scrollSnapAlign: 'start' }) as object) },
  separator: { width: GAP },
})
