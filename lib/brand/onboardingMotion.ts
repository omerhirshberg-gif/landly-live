import type { Bezier, Spring } from './entranceTimeline'

// Motion for the post-sign-in onboarding cards, shared by the Expo app
// (Reanimated) and the Next.js wizard (CSS), so both move at the same slow,
// calm pace on the same curves. Plain numbers only: each platform builds its
// own easing objects from these (the web as cubic-bezier() strings, native as
// Easing.bezier / cubicBezier — never a CSS string).
//
// A card change is one overlapping hand-over:
//   0   – 300  outgoing card fades out, drifting toward the side it leaves by
//   120 – 600  incoming card fades in from the other side and settles
//              (its title, body and actions follow 60ms apart, rising 6px)
// On both platforms the stage is as tall as the current card — never measured,
// never animated — and the leaving card overlaps it while it fades.

/** Long, calm settle: quick to start, no visible end. Used for everything that arrives. */
export const EASE_SILK = [0.16, 1, 0.3, 1] as const satisfies Bezier
/** Material "standard" curve, for opacity-only exits. */
export const EASE_FADE = [0.4, 0, 0.2, 1] as const satisfies Bezier

export const ONB = {
  stepInMs: 480,
  stepOutMs: 300,
  /** The incoming card starts this long after the outgoing one, so they overlap. */
  stepInDelayMs: 120,
  /** Horizontal drift for both cards (Reanimated's FadeInRight/FadeOutLeft travel). */
  driftPx: 25,
  /** Delay between the title, body and actions of the incoming card. */
  staggerMs: 60,
  staggerRisePx: 6,
  /** Picking a language: fade out, flip locale + direction while invisible, fade back in. */
  langOutMs: 200,
  langInMs: 420,
  /** The persona "Other" note and other in-card reveals. */
  revealMs: 450,
  /** Leaving the auth screen (into the wizard, or from the last card to home). */
  screenOutMs: 500,
  screenInMs: 520,
  screenRisePx: 8,
  /** Home greeting fading in once the name is known. */
  greetingMs: 480,
  pressMs: 220,
  hoverScale: 1.01,
  pressScale: 0.98,
  ringMs: 260,
  /** The header's progress line filling toward the next card, on EASE_SILK. */
  progressMs: 520,
  /** Celebration: copy follows the badge by this much; the halo then breathes slowly. */
  celebrateCopyDelayMs: 180,
  haloInMs: 900,
  haloBreatheMs: 2400,
  /** Reduced motion: no travel, no loops — every change is a short cross-fade. */
  reducedMs: 200,
} as const

/** The celebration badge: just over critically damped (ζ ≈ 1.05), so it lands without a bounce. */
export const CELEBRATE_SPRING = { damping: 20, stiffness: 90 } as const satisfies Spring
export const CELEBRATE_FROM_SCALE = 0.6

/** Delay before the n-th element (0-based) of an incoming card starts. */
export function staggerDelay(index: number): number {
  return ONB.stepInDelayMs + index * ONB.staggerMs
}
