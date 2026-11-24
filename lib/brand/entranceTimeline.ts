// The auth entrance choreography, shared by the Expo app (Reanimated) and the
// Next.js login page (CSS keyframes) so both play the same sequence with the
// same curves. Plain numbers only: each platform builds its own easing
// objects from these.
//
//   0    –  950  Star of David + arch: scale 0.85 -> 1, outline first, then fill
//   950  – 1500  Arrow bursts out of its tail and springs into place
//   1500 – 1950  Wordmark and slogan fade in
//   1950 – 2550  Diagonal shine sweeps bottom-left -> top-right
//   2550 – 2950  Hold (SPLASH_HOLD_MS): the finished logo rests, while auth resolves
//   2950 –       Hand-over: the logo glides up (800ms) as the card rises (~3.7s in)
export const T = {
  arrow: 950,
  reveal: 1500,
  slogan: 1600,
  shine: 1950,
  shineMs: 600,
  // Stage 1 detail: the outline draws in, holds, then hands over to the fill.
  outlineInMs: 380,
  outlineHoldMs: 300,
  outlineOutMs: 250,
  fillDelay: 300,
  arrowFadeMs: 140,
  revealMs: 500,
  // Reduced motion: a single fade of the finished mark.
  reducedMs: 400,
} as const

export type Bezier = readonly [number, number, number, number]

export const CURVES = {
  easeOut: [0.23, 1, 0.32, 1],
  easeOutSoft: [0.22, 1, 0.36, 1],
  easeInOut: [0.65, 0, 0.35, 1],
  // Reanimated's withTiming default, Easing.inOut(Easing.quad).
  timingDefault: [0.455, 0.03, 0.515, 0.955],
} as const satisfies Record<string, Bezier>

export interface Spring {
  damping: number
  stiffness: number
  mass?: number
}

// Low damping ratio (~0.4): the arrow overshoots and rings briefly as it docks.
export const ARROW_SPRING = { damping: 12, stiffness: 220, mass: 1 } as const satisfies Spring
// One spring for everything else that moves in the entrance (the card's rise):
// slightly over-damped, so it settles without a wobble.
export const ENTRANCE_SPRING = { damping: 18, stiffness: 70 } as const satisfies Spring
// How long the finished logo rests (after the shine, before the hand-over)
// while auth resolves in the background; it never delays a slower auth.
export const SPLASH_HOLD_MS = 400
// The splash logo's hand-over glide is native only: its critically damped
// springs live with it (landly-mobile/src/lib/splashMotion.ts GLIDE).
export const SPLASH_BACKDROP_MS = 420
// Once the glide lands, the screen's own logo shows under the splash's and
// the splash fades off it: two identical marks crossfading, never a cut.
export const SPLASH_RELEASE_MS = 140

/** The latest a duration-based spring can still be moving: its 1.5x settle plus slack for dropped frames. */
export function splashGlideBackstopMs(duration: number): number {
  return Math.round(duration * 1.5) + 600
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The translation that lands the splash hero's lockup (its top
 * `lockupHeight`, above the slogan) on `target` while the hero scales by
 * `scale` about its own centre, as React Native transforms do.
 */
export function glideToLockup(from: Box, target: Box, lockupHeight: number, scale: number): { x: number; y: number } {
  const cx = from.x + from.width / 2
  const cy = from.y + from.height / 2
  const lockupCy = cy + (from.y + lockupHeight / 2 - cy) * scale
  return { x: target.x + target.width / 2 - cx, y: target.y + target.height / 2 - lockupCy }
}

// Start poses (px at the 112px emblem size both platforms render).
export const FROM = {
  baseScale: 0.85,
  arrowY: 46,
  arrowScale: 0.55,
  wordmarkY: 6,
  cardRise: 40,
} as const

// The form card: rises on ENTRANCE_SPRING while fading in over CARD_FADE_MS.
export const CARD_DELAY_MS = 60
export const CARD_FADE_MS = 520

/** Damped-spring position at time `t` (s), from 0 to a target of 1, starting at rest. */
export function springProgress({ damping, stiffness, mass = 1 }: Spring, t: number): number {
  const w0 = Math.sqrt(stiffness / mass)
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta)
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
  }
  if (zeta === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t)
  const r1 = -w0 * (zeta - Math.sqrt(zeta * zeta - 1))
  const r2 = -w0 * (zeta + Math.sqrt(zeta * zeta - 1))
  return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1)
}

/**
 * The same spring as a CSS `linear()` timing function plus the duration it
 * takes to settle (within `rest` of the target), so a web keyframe animation
 * follows Reanimated's withSpring curve, overshoot included.
 */
export function springToCssLinear(spring: Spring, { samples = 48, rest = 0.001 } = {}): { easing: string; durationMs: number } {
  const { damping, stiffness, mass = 1 } = spring
  const decay = damping / (2 * mass) // envelope rate, zeta * w0
  // The envelope e^(-decay t) bounds the oscillation; stop once it is under `rest`.
  const settle = Math.max(0.1, Math.log(2 / rest) / decay)
  const points: string[] = []
  for (let i = 0; i <= samples; i++) {
    const p = i === samples ? 1 : springProgress(spring, (settle * i) / samples)
    points.push(String(Math.round(p * 10000) / 10000))
  }
  return { easing: `linear(${points.join(', ')})`, durationMs: Math.round(settle * 1000) }
}

/**
 * How long after `SplashScreen.hide()` the native launch screen is still on
 * screen: its fade (`NativeSplash.setOptions({ duration })`, 200ms in
 * _layout.tsx) plus a margin for the compositor to commit the frames. The
 * intro is held at 0% until then, so Stage 1 (the star drawing) is never
 * played under the fading overlay. The web has no native splash: no wait.
 */
export const NATIVE_SPLASH_FADE_MS = 200
export const NATIVE_SPLASH_CLEARANCE_MS = { android: 260, ios: 120, web: 0 } as const

export function nativeSplashClearanceMs(os: string): number {
  if (os === 'android') return NATIVE_SPLASH_CLEARANCE_MS.android
  if (os === 'ios') return NATIVE_SPLASH_CLEARANCE_MS.ios
  return NATIVE_SPLASH_CLEARANCE_MS.web
}
