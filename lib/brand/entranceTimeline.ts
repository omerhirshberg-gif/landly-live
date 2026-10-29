// The auth entrance choreography, shared by the Expo app (Reanimated) and the
// Next.js login page (CSS keyframes) so both play the same sequence with the
// same curves. Plain numbers only: each platform builds its own easing
// objects from these.
//
//   0    – 1100  Star of David + arch: scale 0.85 -> 1, outline first, then fill
//   1100 – 1750  Arrow bursts out of its tail and springs into place
//   1750 – 2300  Wordmark and slogan fade in
//   2300 – 2950  Diagonal shine sweeps bottom-left -> top-right
export const T = {
  arrow: 1100,
  reveal: 1750,
  slogan: 1870,
  shine: 2300,
  shineMs: 650,
  // Stage 1 detail: the outline draws in, holds, then hands over to the fill.
  outlineInMs: 450,
  outlineHoldMs: 350,
  outlineOutMs: 300,
  fillDelay: 350,
  arrowFadeMs: 140,
  revealMs: 550,
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
// One spring for everything else that moves in the entrance (card rise, splash hand-over).
export const ENTRANCE_SPRING = { damping: 15, stiffness: 90 } as const satisfies Spring
// The splash logo's hand-over glide (native only), as Reanimated
// duration-based springs: `duration` is perceptual and the spring settles at
// 1.5x it. Near-critical, so the logo lands without a visible overshoot; the
// glide into the app lock's header travels further and shrinks, so it gets a
// little longer and a touch livelier.
export const SPLASH_GLIDE = {
  login: { duration: 650, dampingRatio: 0.9 },
  lock: { duration: 750, dampingRatio: 0.86 },
} as const
export const SPLASH_BACKDROP_MS = 420
// Once the glide lands, the screen's own logo shows under the splash's and
// the splash fades off it: two identical marks crossfading, never a cut.
export const SPLASH_RELEASE_MS = 140

/** The latest a glide can still be moving: its spring's 1.5x settle plus slack for dropped frames. */
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
export const CARD_FADE_MS = 420

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
