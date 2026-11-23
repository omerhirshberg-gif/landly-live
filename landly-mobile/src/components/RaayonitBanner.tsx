import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { useRouter } from 'expo-router'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { BANNER_INTERVAL_MS, BANNER_SLIDES, nextSlide } from '@shared/home/raayonitBanner'
import { RAAYONIT_HUB } from '@shared/offers/offerRoutes'
import AppText from './AppText'
import Image from './SafeImage'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { useLayout } from '../lib/useLayout'
import { colors } from '../theme'

// Home's entry to the Raayonit Card tab (web: components/perks/RaayonitBanner.tsx): a wide rounded carousel of benefit-led photo slides, each one opening
// the tab. It pages by swipe, dots and the auto-advance (every few seconds; off while paused with the 44px button, while the finger is down, and always
// under Reduce Motion). The row always runs left to right (a scroll offset is not mirrored the same way on every platform); each slide's text follows the language.
const GAP = 10
// Metro resolves require() only from literal paths, so the three photos are listed one by one.
const PHOTOS = {
  dining: require('../../assets/raayonit-banner/dining.webp'),
  spa: require('../../assets/raayonit-banner/spa.webp'),
  shopping: require('../../assets/raayonit-banner/shopping.webp'),
} as const

export default memo(function RaayonitBanner() {
  const { t, isRtl } = useLang()
  const router = useRouter()
  const { rowWidth } = useLayout()
  const ref = useRef<ScrollView>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [touching, setTouching] = useState(false)
  const [reduce, setReduce] = useState(false)
  const total = BANNER_SLIDES.length
  // The width the screen's content spans (side padding off), so a slide fits exactly and never runs under the edge.
  const slideWidth = Math.max(240, rowWidth)
  const step = slideWidth + GAP

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce)
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => sub.remove()
  }, [])

  const goTo = useCallback((i: number) => { ref.current?.scrollTo({ x: i * step, animated: !reduce }); setIndex(i) }, [step, reduce])

  useEffect(() => {
    if (paused || touching || reduce) return
    const id = setTimeout(() => goTo(nextSlide(index, total)), BANNER_INTERVAL_MS)
    return () => clearTimeout(id)
  }, [index, paused, touching, reduce, goTo, total])

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.min(total - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step))))
  const label = (i: number) => t('chains_banner_go').replace('{n}', String(i + 1)).replace('{total}', String(total))

  return (
    <View style={styles.wrap} accessibilityLabel={t('chains_banner_label')}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled={false}
        showsVerticalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setTouching(true)}
        onScrollEndDrag={() => setTouching(false)}
        onMomentumScrollEnd={onEnd}
        contentContainerStyle={[styles.row, { gap: GAP }]}
        style={{ direction: 'ltr' }}
      >
        {BANNER_SLIDES.map((slide, i) => (
          <Pressable key={slide.key} accessibilityRole="link" accessibilityLabel={`${t(slide.key)}. ${t('chains_live_cta')}`} accessibilityHint={label(i)} onPress={() => router.push(RAAYONIT_HUB)} style={[styles.slide, { width: slideWidth, direction: isRtl ? 'rtl' : 'ltr' }]}>
            <Image source={PHOTOS[slide.photo]} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory" accessibilityIgnoresInvertColors />
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id={`bannerScrim-${slide.photo}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#020617" stopOpacity={0.12} />
                    <Stop offset="0.3" stopColor="#020617" stopOpacity={0.42} />
                    <Stop offset="1" stopColor="#020617" stopOpacity={0.86} />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill={`url(#bannerScrim-${slide.photo})`} />
              </Svg>
            </View>
            <View style={styles.copy}>
              <AppText style={styles.title}>{t(slide.key)}</AppText>
              <View style={styles.cta}>
                <AppText numberOfLines={1} style={styles.ctaText}>{t('chains_live_cta')}</AppText>
                <LineIcon name="chevronEnd" size={16} color="#FFFFFF" strokeWidth={2} flip={isRtl} />
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.controls}>
        <View style={styles.dots}>
          {BANNER_SLIDES.map((s, i) => (
            <Pressable key={s.key} accessibilityRole="button" accessibilityLabel={label(i)} accessibilityState={{ selected: i === index }} onPress={() => goTo(i)} hitSlop={{ top: 12, bottom: 12 }} style={styles.dotHit}>
              <View style={[styles.dot, i === index && styles.dotOn]} />
            </Pressable>
          ))}
        </View>
        {!reduce && (
          <Pressable accessibilityRole="button" accessibilityLabel={paused ? t('chains_banner_play') : t('chains_banner_pause')} accessibilityState={{ selected: paused }} onPress={() => setPaused((p) => !p)} style={styles.pause}>
            <LineIcon name={paused ? 'play' : 'pause'} size={18} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        )}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: { marginTop: 16 },
  row: { paddingBottom: 2 },
  slide: { height: 184, borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)', backgroundColor: colors.brandTint, justifyContent: 'flex-end' },
  copy: { padding: 18, paddingBottom: 46, gap: 4, alignItems: 'flex-start' },
  title: { fontSize: 21, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4, color: '#FFFFFF', textShadowColor: 'rgba(2,6,23,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ctaText: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: '#FFFFFF', textShadowColor: 'rgba(2,6,23,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  controls: { direction: 'ltr', flexDirection: 'row', position: 'absolute', start: 12, end: 12, bottom: 4, alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', alignItems: 'center' },
  dotHit: { width: 26, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotOn: { width: 24, backgroundColor: '#FFFFFF' },
  pause: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
})
