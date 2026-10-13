import { useEffect } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
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
import { scheduleOnRN } from 'react-native-worklets'
import { ArrowLayer, BaseLayer, BaseOutlineLayer, ShineLayer, StaticEmblem } from './Emblem'
import { EMBLEM_VIEWBOX } from './emblemPaths'
import RadialGlow from './RadialGlow'

// The vector Landly emblem over a soft blue radial glow, the "Landly"
// wordmark (assets/logo-wordmark.png, background removed) and the slogan as
// live text. The splash plays it with `intro`; the login header renders the
// finished state at the same size, so the splash can hand its logo over to
// the login screen without a seam.
const EMBLEM_W = 112
export const EMBLEM = { width: EMBLEM_W, height: Math.round((EMBLEM_W * EMBLEM_VIEWBOX.height) / EMBLEM_VIEWBOX.width) }
const WORDMARK = { width: 104, height: 29.5 } // logo-wordmark.png is 169x48
const GAP = 8
const SLOGAN_HEIGHT = 14
export const HERO = { width: 240, height: EMBLEM.height + GAP + WORDMARK.height + GAP + SLOGAN_HEIGHT }
const GLOW = 340

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
const EASE_OUT_SOFT = Easing.bezier(0.22, 1, 0.36, 1)
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1)
// Low damping ratio (~0.4): the arrow overshoots and rings briefly as it docks.
const ARROW_SPRING = { damping: 12, stiffness: 220, mass: 1 }

// The staged intro (ms):
//   0    – 1100  Star of David + arch: scale 0.85 -> 1, outline first, then fill
//   1100 – 1750  Arrow bursts out of its tail and springs into place
//   1750 – 2300  Glow, wordmark and slogan fade in
//   2300 – 2950  Diagonal shine sweeps bottom-left -> top-right
const T = { arrow: 1100, reveal: 1750, slogan: 1870, shine: 2300, shineMs: 650 }

export default function BrandHero({ intro = false, onIntroDone }: { intro?: boolean; onIntroDone?: () => void }) {
  const reduced = useReducedMotion()
  const staged = intro && !reduced
  const start = (from: number) => (staged ? from : 1)

  const baseScale = useSharedValue(staged ? 0.85 : 1)
  const outline = useSharedValue(0)
  const fill = useSharedValue(start(0))
  const arrowOpacity = useSharedValue(start(0))
  const arrowY = useSharedValue(staged ? 46 : 0)
  const arrowScale = useSharedValue(staged ? 0.55 : 1)
  const reveal = useSharedValue(start(0))
  const slogan = useSharedValue(start(0))
  const shine = useSharedValue(staged ? 0 : 1)
  // Reduced motion keeps only a gentle fade of the finished mark.
  const whole = useSharedValue(intro && reduced ? 0 : 1)

  useEffect(() => {
    if (!intro) return
    const done = () => onIntroDone?.()
    if (!staged) {
      whole.set(withTiming(1, { duration: 400, easing: EASE_OUT }, (fin) => fin && scheduleOnRN(done)))
      return
    }
    // Stage 1 — Star of David assembly
    baseScale.set(withTiming(1, { duration: T.arrow, easing: EASE_OUT_SOFT }))
    outline.set(withSequence(withTiming(1, { duration: 450, easing: EASE_OUT }), withDelay(350, withTiming(0, { duration: 300 }))))
    fill.set(withDelay(350, withTiming(1, { duration: T.arrow - 350, easing: EASE_IN_OUT })))
    // Stage 2 — arrow burst
    arrowOpacity.set(withDelay(T.arrow, withTiming(1, { duration: 140 })))
    arrowY.set(withDelay(T.arrow, withSpring(0, ARROW_SPRING)))
    arrowScale.set(withDelay(T.arrow, withSpring(1, ARROW_SPRING)))
    // Stage 3 — glow, wordmark, slogan
    reveal.set(withDelay(T.reveal, withTiming(1, { duration: 550, easing: EASE_OUT })))
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
  const glowStyle = useAnimatedStyle(() => ({
    opacity: reveal.get(),
    transform: [{ scale: 0.85 + 0.15 * reveal.get() }],
  }))
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: reveal.get(),
    transform: [{ translateY: 6 * (1 - reveal.get()) }],
  }))
  const sloganStyle = useAnimatedStyle(() => ({ opacity: slogan.get() }))

  return (
    <Animated.View
      style={[styles.hero, wholeStyle]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Landly — Lifestyle & Growth"
    >
      <Animated.View style={[styles.glow, glowStyle]}>
        <RadialGlow size={GLOW} color="#0066FF" intensity={0.14} style={styles.glowFill} />
      </Animated.View>

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
        <Image source={require('../../assets/logo-wordmark.png')} style={styles.wordmark} resizeMode="contain" />
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
  // Centered on the emblem rather than the whole block.
  glow: { position: 'absolute', width: GLOW, height: GLOW, left: (HERO.width - GLOW) / 2, top: (EMBLEM.height - GLOW) / 2 },
  glowFill: { left: 0, top: 0 },
  emblem: EMBLEM,
  arrowOrigin: { transformOrigin: '12% 96%' },
  wordmark: { ...WORDMARK, marginTop: GAP },
  // Ink colour sampled from the wordmark so the live slogan matches the artwork.
  slogan: {
    marginTop: GAP,
    height: SLOGAN_HEIGHT,
    lineHeight: SLOGAN_HEIGHT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3.2,
    color: '#19264b',
    textAlign: 'center',
    writingDirection: 'ltr',
  },
})
