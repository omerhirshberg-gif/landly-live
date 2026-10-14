import type { CSSProperties } from 'react'
import { springToCssLinear, type Bezier } from '@/lib/brand/entranceTimeline'
import { CELEBRATE_FROM_SCALE, CELEBRATE_SPRING, EASE_FADE, EASE_SILK, ONB } from '@/lib/brand/onboardingMotion'

// The shared onboarding motion (lib/brand/onboardingMotion.ts, also driving
// the Expo wizard) as CSS custom properties for entrance.module.css. The
// celebration spring becomes a CSS linear() curve sampled from the same
// physics as Reanimated's withSpring.
const bezier = ([a, b, c, d]: Bezier) => `cubic-bezier(${a}, ${b}, ${c}, ${d})`
const ms = (n: number) => `${n}ms`
const px = (n: number) => `${n}px`

const celebrate = springToCssLinear(CELEBRATE_SPRING)

export const ONBOARDING_VARS = {
  '--onb-ease': bezier(EASE_SILK),
  '--onb-fade': bezier(EASE_FADE),
  '--onb-in': ms(ONB.stepInMs),
  '--onb-out': ms(ONB.stepOutMs),
  '--onb-in-delay': ms(ONB.stepInDelayMs),
  '--onb-drift': px(ONB.driftPx),
  '--onb-stagger': ms(ONB.staggerMs),
  '--onb-rise': px(ONB.staggerRisePx),
  '--onb-lang-out': ms(ONB.langOutMs),
  '--onb-lang-in': ms(ONB.langInMs),
  '--onb-reveal': ms(ONB.revealMs),
  '--onb-screen-out': ms(ONB.screenOutMs),
  '--onb-screen-in': ms(ONB.screenInMs),
  '--onb-screen-rise': px(ONB.screenRisePx),
  '--onb-press': ms(ONB.pressMs),
  '--onb-ring': ms(ONB.ringMs),
  '--onb-progress': ms(ONB.progressMs),
  '--onb-copy-delay': ms(ONB.celebrateCopyDelayMs),
  '--onb-halo-in': ms(ONB.haloInMs),
  '--onb-halo-breathe': ms(ONB.haloBreatheMs),
  '--onb-reduced': ms(ONB.reducedMs),
  '--onb-celebrate-spring': celebrate.easing,
  '--onb-celebrate-ms': ms(celebrate.durationMs),
  '--onb-celebrate-from': String(CELEBRATE_FROM_SCALE),
} as CSSProperties
