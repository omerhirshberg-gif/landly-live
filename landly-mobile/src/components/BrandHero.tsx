import { useEffect } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'
import { ArrowLayer, BaseLayer, BaseOutlineLayer, ShineLayer, StaticEmblem } from './Emblem'
import { EMBLEM_AXIS_X, EMBLEM_VIEWBOX } from '@shared/brand/emblemPaths'
import { WORDMARK_COLOR, WORDMARK_PATH, WORDMARK_VIEWBOX } from '@shared/brand/wordmarkPath'
import { ARROW_SPRING, CURVES, FROM, T } from '@shared/brand/entranceTimeline'

// The vector Landly emblem, the vector "Landly" wordmark
// (lib/brand/wordmarkPath.ts) and the slogan as live text. The splash plays it with `intro`; the login header renders the
// finished state at the same size, so the splash can hand its logo over to
// the login screen without a seam.
const EMBLEM_W = 112
export const EMBLEM = { width: EMBLEM_W, height: Math.round((EMBLEM_W * EMBLEM_VIEWBOX.height) / EMBLEM_VIEWBOX.width) }
// The emblem box is offset so the star's axis, not the box (whose right side
// holds the arrow's reach), sits over the centre of the text, as in the master
// logo. Rounded to a whole pixel.
const EMBLEM_SHIFT = Math.round(((EMBLEM_VIEWBOX.width / 2 - EMBLEM_AXIS_X) * EMBLEM_W) / EMBLEM_VIEWBOX.width)
// Whole pixels throughout, so nothing lands on a half-pixel row.
const WORDMARK = { width: 100, height: 28 }
const WORDMARK_VB = `${WORDMARK_VIEWBOX.x} ${WORDMARK_VIEWBOX.y} ${WORDMARK_VIEWBOX.width} ${WORDMARK_VIEWBOX.height}`
const WORDMARK_GAP = 10
const GAP = 8
const SLOGAN_HEIGHT = 14
const SLOGAN_TRACKING = 3.2
export const HERO = { width: 240, height: EMBLEM.height + WORDMARK_GAP + WORDMARK.height + GAP + SLOGAN_HEIGHT }

const EASE_OUT = Easing.bezier(...CURVES.easeOut)
const EASE_OUT_SOFT = Easing.bezier(...CURVES.easeOutSoft)
const EASE_IN_OUT = Easing.bezier(...CURVES.easeInOut)

// The staged intro's timings and curves live in lib/brand/entranceTimeline.ts,
// shared with the web login page (components/auth/BrandHero.tsx) so both
// platforms play the same sequence.

export default function BrandHero({ intro = false, onIntroDone }: { intro?: boolean; onIntroDone?: () => void }) {
  const reduced = useReducedMotion()
  const staged = intro && !reduced
  const start = (from: number) => (staged ? from : 1)

  const baseScale = useSharedValue(staged ? FROM.baseScale : 1)
  const outline = useSharedValue(0)
  const fill = useSharedValue(start(0))
  const arrowOpacity = useSharedValue(start(0))
  const arrowY = useSharedValue(staged ? FROM.arrowY : 0)
  const arrowScale = useSharedValue(staged ? FROM.arrowScale : 1)
  const reveal = useSharedValue(start(0))
  const slogan = useSharedValue(start(0))
  const shine = useSharedValue(staged ? 0 : 1)
  // Reduced motion keeps only a gentle fade of the finished mark.
  const whole = useSharedValue(intro && reduced ? 0 : 1)

  useEffect(() => {
    if (!intro) return
    const done = () => onIntroDone?.()
    if (!staged) {
      whole.set(withTiming(1, { duration: T.reducedMs, easing: EASE_OUT }, (fin) => fin && scheduleOnRN(done)))
      return
    }
    // Stage 1 — Star of David assembly
    baseScale.set(withTiming(1, { duration: T.arrow, easing: EASE_OUT_SOFT }))
    outline.set(
      withSequence(
        withTiming(1, { duration: T.outlineInMs, easing: EASE_OUT }),
        withDelay(T.outlineHoldMs, withTiming(0, { duration: T.outlineOutMs })),
      ),
    )
    fill.set(withDelay(T.fillDelay, withTiming(1, { duration: T.arrow - T.fillDelay, easing: EASE_IN_OUT })))
    // Stage 2 — arrow burst
    arrowOpacity.set(withDelay(T.arrow, withTiming(1, { duration: T.arrowFadeMs })))
    arrowY.set(withDelay(T.arrow, withSpring(0, ARROW_SPRING)))
    arrowScale.set(withDelay(T.arrow, withSpring(1, ARROW_SPRING)))
    // Stage 3 — wordmark, slogan
    reveal.set(withDelay(T.reveal, withTiming(1, { duration: T.revealMs, easing: EASE_OUT })))
    slogan.set(withDelay(T.slogan, withTiming(1, { duration: T.shine - T.slogan, easing: EASE_OUT })))
    // Stage 4 — shine sweep, then hand back to the splash
    shine.set(withDelay(T.shine, withTiming(1, { duration: T.shineMs, easing: EASE_IN_OUT }, (fin) => fin && scheduleOnRN(done))))
    // Shared values are stable refs; the intro runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const wholeStyle = useAnimatedStyle(() => ({ opacity: whole.get() }))
  const baseStyle = useAnimatedStyle(() => ({ transform: [{ scale: baseScale.get() }] }))
  const outlineStyle = useAnimatedStyle(() => ({ opacity: outline.get() }))
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.get() }))
  const arrowStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.get(),
    transform: [{ translateY: arrowY.get() }, { scale: arrowScale.get() }],
  }))
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: reveal.get(),
    transform: [{ translateY: FROM.wordmarkY * (1 - reveal.get()) }],
  }))
  const sloganStyle = useAnimatedStyle(() => ({ opacity: slogan.get() }))

  return (
    <Animated.View
      style={[styles.hero, wholeStyle]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Landly — Lifestyle & Growth"
    >
      <View style={styles.emblem}>
        {staged ? (
          <>
            <Animated.View style={[StyleSheet.absoluteFill, baseStyle]}>
              <Animated.View style={[StyleSheet.absoluteFill, outlineStyle]}>
                <BaseOutlineLayer />
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
                <BaseLayer />
              </Animated.View>
            </Animated.View>
            {/* Grows out of its tail (bottom-left) so it reads as bursting out of the arch. */}
            <Animated.View style={[StyleSheet.absoluteFill, styles.arrowOrigin, arrowStyle]}>
              <ArrowLayer />
            </Animated.View>
            <ShineLayer progress={shine} />
          </>
        ) : (
          <StaticEmblem />
        )}
      </View>

      <Animated.View style={wordmarkStyle}>
        <Svg viewBox={WORDMARK_VB} width={WORDMARK.width} height={WORDMARK.height} style={styles.wordmark}>
          <Path d={WORDMARK_PATH} fill={WORDMARK_COLOR} />
        </Svg>
      </Animated.View>
      <Animated.View style={sloganStyle}>
        <Text style={styles.slogan} allowFontScaling={false} numberOfLines={1}>
          LIFESTYLE & GROWTH
        </Text>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  hero: { ...HERO, alignItems: 'center' },
  emblem: { ...EMBLEM, left: EMBLEM_SHIFT },
  arrowOrigin: { transformOrigin: '12% 96%' },
  wordmark: { ...WORDMARK, marginTop: WORDMARK_GAP },
  // Same ink as the wordmark. iOS and browsers add the letter-spacing after the
  // last letter too (Android splits it either side of each letter); the
  // matching start padding keeps the letters themselves centred.
  slogan: {
    marginTop: GAP,
    paddingLeft: Platform.OS === 'android' ? 0 : SLOGAN_TRACKING,
    height: SLOGAN_HEIGHT,
    lineHeight: SLOGAN_HEIGHT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: SLOGAN_TRACKING,
    color: '#19264b',
    textAlign: 'center',
    writingDirection: 'ltr',
  },
})
