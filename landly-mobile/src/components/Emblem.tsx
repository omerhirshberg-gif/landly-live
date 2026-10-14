import { StyleSheet, type ViewStyle } from 'react-native'
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { ARCH, ARROW, EMBLEM_COLORS, EMBLEM_VIEWBOX, STAR } from '@shared/brand/emblemPaths'
import { webOnly } from '../lib/webStyles'

const VIEWBOX = `0 0 ${EMBLEM_VIEWBOX.width} ${EMBLEM_VIEWBOX.height}`
type Part = typeof STAR

function PartPaths({ part }: { part: Part }) {
  return (
    <>
      <Path d={part.light} fill={EMBLEM_COLORS.light} fillRule="evenodd" />
      <Path d={part.dark} fill={EMBLEM_COLORS.dark} fillRule="evenodd" />
    </>
  )
}

// Every layer is a full-size SVG over the same viewBox, so stacked layers line
// up exactly and the static emblem is pixel-identical to the assembled intro.
// The paths are exact geometry (see lib/brand/emblemPaths.ts). iOS and Android
// always anti-alias them geometrically; on web the CSS shape-rendering asks the
// browser for the same (react-native-svg has no prop for it, and RN's style
// types don't know the property).
const CRISP = webOnly({ shapeRendering: 'geometricPrecision' }) as unknown as ViewStyle

function Layer({ children }: { children: React.ReactNode }) {
  return (
    <Svg viewBox={VIEWBOX} width="100%" height="100%" style={[StyleSheet.absoluteFill, CRISP]}>
      {children}
    </Svg>
  )
}

export function StaticEmblem() {
  return (
    <Layer>
      <PartPaths part={STAR} />
      <PartPaths part={ARCH} />
      <PartPaths part={ARROW} />
    </Layer>
  )
}

/** Part A: the Star of David and the arch it stands on. */
export function BaseLayer() {
  return (
    <Layer>
      <PartPaths part={STAR} />
      <PartPaths part={ARCH} />
    </Layer>
  )
}

/** Part A as a thin outline, drawn before the fill arrives. */
export function BaseOutlineLayer() {
  return (
    <Layer>
      {[STAR.light, ARCH.light].map((d) => (
        <Path key={d.slice(0, 24)} d={d} fill="none" stroke={EMBLEM_COLORS.light} strokeWidth={5} strokeLinejoin="round" />
      ))}
    </Layer>
  )
}

/** Part B: the arrow. */
export function ArrowLayer() {
  return (
    <Layer>
      <PartPaths part={ARROW} />
    </Layer>
  )
}

// The sheen band is a soft white gradient rect, rotated so it lies across the
// bottom-left -> top-right sweep and moved along it by animating its `x`.
// It's clipped to the emblem's own shapes, so the shine never spills onto the
// background. Animated SVG props work on native and on web (react-native-svg's
// web elements apply them as DOM attributes).
const AnimatedRect = Animated.createAnimatedComponent(Rect)
const CX = EMBLEM_VIEWBOX.width / 2
const CY = EMBLEM_VIEWBOX.height / 2
const BAND = 150
const REACH = 380 // half-diagonal of the viewBox, plus a margin
const X_FROM = CX - REACH - BAND
const X_TO = CX + REACH

export function ShineLayer({ progress }: { progress: SharedValue<number> }) {
  const bandProps = useAnimatedProps(() => ({ x: X_FROM + (X_TO - X_FROM) * progress.get() }))
  return (
    <Layer>
      <Defs>
        <ClipPath id="landlyEmblemClip">
          {[STAR.light, ARCH.light, ARROW.light].map((d) => (
            <Path key={d.slice(0, 24)} d={d} clipRule="evenodd" />
          ))}
        </ClipPath>
        <LinearGradient id="landlyShine" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
          <Stop offset="0.5" stopColor="#ffffff" stopOpacity={0.6} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <G clipPath="url(#landlyEmblemClip)">
        {/* rotate(-45): the band's x axis points up-right, its long side runs top-left -> bottom-right. */}
        <G transform={`rotate(-45 ${CX} ${CY})`}>
          <AnimatedRect animatedProps={bandProps} x={X_FROM} y={CY - 460} width={BAND} height={920} fill="url(#landlyShine)" />
        </G>
      </G>
    </Layer>
  )
}
