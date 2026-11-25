import { useEffect, useId } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { ARCH, ARROW, STAR } from '@shared/brand/emblemPaths'
import { LOADER, LOADER_OFFSET, loaderTilt, loaderTravel, STAR_CENTRE, type LoaderSize } from '@shared/brand/loaderSpec'
import { useLang } from '../i18n/LangProvider'

// The brand loader for full-area waits (web: components/ui/BrandLoader.tsx, both
// drawn from lib/brand/loaderSpec.ts): the real emblem in two pale tones with a
// soft blue band sweeping across it, clipped to the emblem's own silhouette.
// A skeleton in the shape of the mark. It loops with no intro or outro (the band
// is off the mark at both ends of a cycle), and the Star of David sits on the
// exact centre of the box, not the emblem's bounding box.
//
// Only react-native-svg props and a Reanimated shared value: the band's `x`
// moves through animatedProps, the same way the splash's ShineLayer moves its
// sheen. The sweep and its tilt mirror in Hebrew; the mark never does. With
// Reduce Motion on, the band is gone and the pale mark only breathes in opacity.
const AnimatedRect = Animated.createAnimatedComponent(Rect)
const SWEEP_MS = Math.round(LOADER.cycleMs * LOADER.sweepShare)
const REST_MS = LOADER.cycleMs - SWEEP_MS
const SWEEP_EASE = Easing.bezier(...LOADER.curve)
const { width: BAND_W, height: BAND_H } = LOADER.band

export default function BrandLoader({
  size = 'md',
  fill = false,
  label,
  decorative = false,
  style,
}: {
  /** sm 56, md 112, lg 212 (dp), or any dp. */
  size?: LoaderSize | number
  /** Centre in the parent, taking all the room it has (a full-area wait). */
  fill?: boolean
  /** The screen-reader label; defaults to "Loading…". */
  label?: string
  /** Hidden from screen readers, for a wait the text beside it (or a labelled parent) already announces. */
  decorative?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { t, isRtl } = useLang()
  const reduced = useReducedMotion()
  const px = typeof size === 'number' ? size : LOADER.sizes[size]
  // ids are document-wide on the web target, so each loader gets its own.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const clipId = `landlyLoaderClip${uid}`
  const bandId = `landlyLoaderBand${uid}`

  const { from, to } = loaderTravel(isRtl)
  const progress = useSharedValue(0)
  const breathe = useSharedValue(1)
  useEffect(() => {
    if (reduced) {
      cancelAnimation(progress)
      breathe.set(withRepeat(withTiming(LOADER.breatheFrom, { duration: LOADER.breatheMs, easing: Easing.inOut(Easing.ease) }), -1, true))
    } else {
      cancelAnimation(breathe)
      breathe.set(1)
      progress.set(0)
      // Sweep, then rest with the band off the mark; the repeat's jump back to 0 happens off the mark too.
      progress.set(withRepeat(withSequence(withTiming(1, { duration: SWEEP_MS, easing: SWEEP_EASE }), withTiming(1, { duration: REST_MS })), -1, false))
    }
    return () => {
      cancelAnimation(progress)
      cancelAnimation(breathe)
    }
  }, [reduced, progress, breathe])

  const bandProps = useAnimatedProps(() => ({ x: STAR_CENTRE.x + from + (to - from) * progress.get() - BAND_W / 2 }))
  const breatheStyle = useAnimatedStyle(() => ({ opacity: breathe.get() }))
  const tilt = loaderTilt(isRtl)

  return (
    <Animated.View
      entering={FadeIn.delay(LOADER.showDelayMs).duration(LOADER.fadeInMs)}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'progressbar'}
      accessibilityLabel={decorative ? undefined : (label ?? t('bizdash_loading'))}
      importantForAccessibility={decorative ? 'no-hide-descendants' : undefined}
      style={[fill && styles.fill, style]}
    >
      <Animated.View style={[{ width: px, height: px }, breatheStyle]}>
        <Svg viewBox={`0 0 ${LOADER.size} ${LOADER.size}`} width={px} height={px}>
          <Defs>
            <ClipPath id={clipId}>
              {[STAR.light, ARCH.light, ARROW.light].map((d) => (
                <Path key={d.slice(0, 24)} d={d} clipRule="evenodd" />
              ))}
            </ClipPath>
            <LinearGradient id={bandId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={LOADER.bandColor} stopOpacity={0} />
              <Stop offset="0.5" stopColor={LOADER.bandColor} stopOpacity={LOADER.band.peakOpacity} />
              <Stop offset="1" stopColor={LOADER.bandColor} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <G transform={`translate(${LOADER_OFFSET.x} ${LOADER_OFFSET.y})`}>
            {[STAR, ARCH, ARROW].map((part) => (
              <G key={part.light.slice(0, 24)}>
                <Path d={part.light} fill={LOADER.pale.light} fillRule="evenodd" />
                <Path d={part.dark} fill={LOADER.pale.dark} fillRule="evenodd" />
              </G>
            ))}
            {!reduced && (
              <G clipPath={`url(#${clipId})`}>
                <G transform={`rotate(${tilt} ${STAR_CENTRE.x} ${STAR_CENTRE.y})`}>
                  <AnimatedRect animatedProps={bandProps} x={STAR_CENTRE.x + from - BAND_W / 2} y={STAR_CENTRE.y - BAND_H / 2} width={BAND_W} height={BAND_H} fill={`url(#${bandId})`} />
                </G>
              </G>
            )}
          </G>
        </Svg>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
