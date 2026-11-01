import { useMemo, useRef, useState } from 'react'
import { Image, Platform, ScrollView, StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { CATEGORY_TILES } from '@shared/categories'
import AppText from './AppText'
import ScalePressable from './ScalePressable'
import { useLang } from '../i18n/LangProvider'
import { carouselSnapOffsets } from '../lib/carousel'
import { CATEGORY_PHOTOS } from '../lib/categoryPhotos'
import { useLayout } from '../lib/useLayout'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

const isWeb = Platform.OS === 'web'

const CARD = { width: 176, height: 110 }
const CARD_PANES = { width: 240, height: 150 }
const GAP = 12

// "Top categories" (web: components/home/CategoryPhotoRail.tsx): every official
// category as a bundled lifestyle photo in a 16:10 card, a dark gradient on its
// lower half only and its name in white at the foot, each opening its category screen and springing to 98% on
// press. One sideways row bleeding through the screen's side padding, snapping
// to its cards (explicit offsets, as OfferCarousel.tsx, which settle a swipe in
// Hebrew too). A dark card sits behind each photo, so the label always reads.
export default function CategoryPhotoRail({ onSelect }: { onSelect: (category: string) => void }) {
  const { t, isRtl } = useLang()
  const { panes, paddingLeft, paddingRight } = useLayout()
  const scroller = useRef<ScrollView>(null)
  const [viewport, setViewport] = useState(0)
  const card = panes ? CARD_PANES : CARD
  const interval = card.width + GAP
  const contentWidth = CATEGORY_TILES.length * interval - GAP + paddingLeft + paddingRight
  const maxOffset = Math.max(0, contentWidth - viewport)
  const snapToOffsets = useMemo(
    () => (isWeb || !viewport ? undefined : carouselSnapOffsets(CATEGORY_TILES.length, interval, maxOffset, isRtl)),
    [interval, maxOffset, isRtl, viewport]
  )

  return (
    <View style={{ marginLeft: -paddingLeft, marginRight: -paddingRight }} onLayout={(e) => setViewport(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToOffsets={snapToOffsets}
        contentContainerStyle={[styles.row, { paddingLeft, paddingRight }]}
        style={styles.scroller}
        // Rows lay out right-to-left in Hebrew, but a horizontal ScrollView
        // still opens at its left edge; jump to the reading-direction start.
        onContentSizeChange={() => {
          if (isRtl) scroller.current?.scrollToEnd({ animated: false })
        }}
      >
        {CATEGORY_TILES.map((tile) => (
          <ScalePressable
            key={tile.category}
            pressedScale={0.98}
            accessibilityRole="link"
            accessibilityLabel={t(tile.labelKey)}
            onPress={() => onSelect(tile.category)}
            style={[styles.card, card]}
          >
            <Image source={CATEGORY_PHOTOS[tile.photo]} style={[styles.photo, card]} resizeMode="cover" accessibilityIgnoresInvertColors />
            <View pointerEvents="none" style={styles.scrim}>
              <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id={`categoryScrim-${tile.photo}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#000000" stopOpacity={0} />
                    <Stop offset="0.5" stopColor="#000000" stopOpacity={0.3} />
                    <Stop offset="1" stopColor="#000000" stopOpacity={0.8} />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill={`url(#categoryScrim-${tile.photo})`} />
              </Svg>
            </View>
            <AppText style={[styles.label, panes && styles.labelPanes]} numberOfLines={2}>
              {t(tile.labelKey)}
            </AppText>
          </ScalePressable>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  row: { gap: GAP, paddingVertical: 4 },
  // A slate-700 card, as the website's, behind the photo.
  card: { justifyContent: 'flex-end', overflow: 'hidden', borderRadius: radius.lg, backgroundColor: '#334155', ...webOnly({ cursor: 'pointer', userSelect: 'none' }) },
  photo: { position: 'absolute', top: 0, start: 0 },
  // The card's lower half (web: h-1/2), so the top of the photo stays bright.
  scrim: { position: 'absolute', start: 0, end: 0, bottom: 0, height: '50%' },
  label: { padding: 12, fontSize: 14, lineHeight: 19, fontWeight: '700', color: colors.white },
  labelPanes: { padding: 16, fontSize: 16, lineHeight: 22 },
})
