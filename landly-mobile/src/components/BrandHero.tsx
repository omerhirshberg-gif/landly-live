import { memo, useEffect } from 'react'
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
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
export const emblemShift = (width: number) => Math.round(((EMBLEM_VIEWBOX.width / 2 - EMBLEM_AXIS_X) * width) / EMBLEM_VIEWBOX.width)
const EMBLEM_SHIFT = emblemShift(EMBLEM_W)
// Whole pixels throughout, so nothing lands on a half-pixel row.
const WORDMARK = { width: 100, height: 28 }
const WORDMARK_VB = `${WORDMARK_VIEWBOX.x} ${WORDMARK_VIEWBOX.y} ${WORDMARK_VIEWBOX.width} ${WORDMARK_VIEWBOX.height}`
const WORDMARK_GAP = 10
const GAP = 8
const SLOGAN_HEIGHT = 14
const SLOGAN_TRACKING = 3.2
/** The emblem and wordmark without the slogan: what the app lock's header shows, scaled. */
export const LOCKUP_HEIGHT = EMBLEM.height + WORDMARK_GAP + WORDMARK.height
/** The app lock's header lockup: the hero at this scale (a 120pt emblem, a little larger than the splash's 112). */
export const LOCKUP_SCALE = 120 / EMBLEM.width
export const HERO = { width: 240, height: LOCKUP_HEIGHT + GAP + SLOGAN_HEIGHT }

const EASE_OUT = Easing.bezier(...CURVES.easeOut)
const EASE_OUT_SOFT = Easing.bezier(...CURVES.easeOutSoft)
const EASE_IN_OUT = Easing.bezier(...CURVES.easeInOut)

// A soft radial brand glow behind the mark, as on the web login
// (entrance.module.css .glow): it swells in with the base, peaks as the shine
// passes and settles at a faint 40%, so the finished logo (and the login
// header it hands over to) never sits in a halo.
const GLOW = 200
const GLOW_REST = 0.4
const GLOW_TOTAL = T.shine + T.shineMs

/** The vector "Landly" wordmark (also the lock screen's, under its emblem). */
export function Wordmark({ width, height, style }: { width: number; height: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Svg viewBox={WORDMARK_VB} width={width} height={height} style={style}>
      <Path d={WORDMARK_PATH} fill={WORDMARK_COLOR} />
    </Svg>
  )
}

// The staged intro's timings and curves live in lib/brand/entranceTimeline.ts,
// shared with the web login page (components/auth/BrandHero.tsx) so both
// platforms play the same sequence.

/**
 * The finished hero without the slogan, at `scale` (the app lock's header):
 * every size is the hero's times `scale`, glow included, so the splash logo
 * gliding in at that scale lands on it exactly.
 */
export function BrandLockup({ scale }: { scale: number }) {
  const glow = GLOW * scale
  return (
    <View style={{ width: HERO.width * scale, height: LOCKUP_HEIGHT * scale, alignItems: 'center' }}>
      <View style={{ width: EMBLEM.width * scale, height: EMBLEM.height * scale, left: EMBLEM_SHIFT * scale }}>
        <View
          pointerEvents="none"
          style={[
            styles.glowAt,
            { width: glow, height: glow, left: ((EMBLEM.width - GLOW) / 2) * scale, top: ((EMBLEM.height - GLOW) / 2) * scale, opacity: GLOW_REST },
          ]}
        >
          <Svg width={glow} height={glow}>
            <Defs>
              <RadialGradient id="landlyLockupGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#0038B8" stopOpacity={0.1} />
                <Stop offset="1" stopColor="#0038B8" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width={glow} height={glow} fill="url(#landlyLockupGlow)" />
          </Svg>
        </View>
        <StaticEmblem />
      </View>
      <Wordmark width={WORDMARK.width * scale} height={WORDMARK.height * scale} style={{ marginTop: WORDMARK_GAP * scale }} />
    </View>
  )
}

// Memoised: the splash's own state changes never re-render the emblem's
// layers mid-intro. `sloganFade` (1 -> 0) lets the splash drop the slogan as
// the logo glides into the app lock's header, which has none.
export default memo(function BrandHero({
  intro = false,
  onIntroDone,
  sloganFade,
}: {
  intro?: boolean
  onIntroDone?: () => void
  sloganFade?: SharedValue<number>
}) {
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
  const glow = useSharedValue(staged ? 0 : GLOW_REST)
  const glowScale = useSharedValue(staged ? 0.8 : 1)
  // Reduced motion keeps only a gentle fade of the finished mark.
  const whole = useSharedValue(intro && reduced ? 0 : 1)

  useEffect(() => {
    if (!intro) return
    const done = () => onIntroDone?.()
    if (!staged) {
      whole.set(withTiming(1, { duration: T.reducedMs, easing: EASE_OUT }, (fin) => fin && scheduleOnRN(done)))
      return
    }
    // The glow, across the whole intro (keyframes 35% / 80% / 100%, as on the web).
    const glowStep = (share: number) => ({ duration: Math.round(GLOW_TOTAL * share), easing: EASE_IN_OUT })
    glow.set(withSequence(withTiming(0.7, glowStep(0.35)), withTiming(1, glowStep(0.45)), withTiming(GLOW_REST, glowStep(0.2))))
    glowScale.set(withSequence(withTiming(1, glowStep(0.35)), withTiming(1.06, glowStep(0.45)), withTiming(1, glowStep(0.2))))
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
  const sloganStyle = useAnimatedStyle(() => ({ opacity: slogan.get() * (sloganFade ? sloganFade.get() : 1) }))
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get(), transform: [{ scale: glowScale.get() }] }))

  return (
    <Animated.View
      style={[styles.hero, wholeStyle]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Landly — Lifestyle & Growth"
    >
      <View style={styles.emblem}>
        <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]}>
          <Svg width={GLOW} height={GLOW}>
            <Defs>
              <RadialGradient id="landlyGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#0038B8" stopOpacity={0.1} />
                <Stop offset="1" stopColor="#0038B8" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width={GLOW} height={GLOW} fill="url(#landlyGlow)" />
          </Svg>
        </Animated.View>
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
        <Wordmark width={WORDMARK.width} height={WORDMARK.height} style={styles.wordmark} />
      </Animated.View>
      <Animated.View style={sloganStyle}>
        <Text style={styles.slogan} allowFontScaling={false} numberOfLines={1}>
          LIFESTYLE & GROWTH
        </Text>
      </Animated.View>
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  hero: { ...HERO, alignItems: 'center' },
  emblem: { ...EMBLEM, left: EMBLEM_SHIFT },
  arrowOrigin: { transformOrigin: '12% 96%' },
  glow: { position: 'absolute', width: GLOW, height: GLOW, left: (EMBLEM.width - GLOW) / 2, top: (EMBLEM.height - GLOW) / 2 },
  glowAt: { position: 'absolute' },
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
