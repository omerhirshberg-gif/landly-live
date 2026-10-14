import { cubicBezier, Easing, FadeInDown, FadeInLeft, FadeInRight, FadeOutLeft, FadeOutRight } from 'react-native-reanimated'
import { EASE_FADE, EASE_SILK, ONB, staggerDelay } from '@shared/brand/onboardingMotion'

// The shared onboarding motion (lib/brand/onboardingMotion.ts, also driving
// the web wizard's CSS) as Reanimated easings and layout-animation builders.
// Easing.bezier for withTiming and layout animations, cubicBezier for
// Reanimated CSS transitions — never a CSS string. The predefined Fade*
// builders travel ONB.driftPx (25px) and run on native and the Expo web build
// alike; Reanimated skips them when the OS asks for reduced motion.
export const SILK = Easing.bezier(...EASE_SILK)
export const FADE = Easing.bezier(...EASE_FADE)
export const SILK_CSS = cubicBezier(...EASE_SILK)
export const FADE_CSS = cubicBezier(...EASE_FADE)

/** The incoming card: from the far side of the reading direction going forward, the near side going back. */
export function stepEntering(fromRight: boolean) {
  return (fromRight ? FadeInRight : FadeInLeft).duration(ONB.stepInMs).delay(ONB.stepInDelayMs).easing(SILK)
}

/** The outgoing card, drifting toward the side opposite the incoming one. */
export function stepExiting(toLeft: boolean) {
  return (toLeft ? FadeOutLeft : FadeOutRight).duration(ONB.stepOutMs).easing(FADE)
}

/** The n-th element (0-based) of an incoming card, rising 6px behind the one before. */
export function rise(index: number, extraDelay = 0) {
  return FadeInDown.duration(ONB.stepInMs)
    .delay(staggerDelay(index) + extraDelay)
    .easing(SILK)
    .withInitialValues({ opacity: 0, transform: [{ translateY: ONB.staggerRisePx }] })
}

/** An in-card reveal with no stagger (the persona "Other" note, an error). */
export function reveal() {
  return FadeInDown.duration(ONB.revealMs)
    .easing(SILK)
    .withInitialValues({ opacity: 0, transform: [{ translateY: ONB.staggerRisePx }] })
}
