import type { CSSProperties } from 'react'
import {
  ARROW_SPRING,
  CARD_DELAY_MS,
  CARD_FADE_MS,
  CURVES,
  ENTRANCE_SPRING,
  FROM,
  T,
  springToCssLinear,
  type Bezier,
} from '@/lib/brand/entranceTimeline'

// The shared entrance timeline (lib/brand/entranceTimeline.ts, also driving
// the Expo app's Reanimated intro) as CSS custom properties, so the keyframes
// in entrance.module.css carry no numbers of their own. Springs become CSS
// linear() curves sampled from the same physics as Reanimated's withSpring.
const bezier = ([a, b, c, d]: Bezier) => `cubic-bezier(${a}, ${b}, ${c}, ${d})`
const ms = (n: number) => `${n}ms`

const arrowSpring = springToCssLinear(ARROW_SPRING)
const cardSpring = springToCssLinear(ENTRANCE_SPRING)

export const ENTRANCE_VARS = {
  '--ease-out': bezier(CURVES.easeOut),
  '--ease-out-soft': bezier(CURVES.easeOutSoft),
  '--ease-in-out': bezier(CURVES.easeInOut),
  '--ease-default': bezier(CURVES.timingDefault),
  '--arrow-spring': arrowSpring.easing,
  '--arrow-spring-ms': ms(arrowSpring.durationMs),
  '--card-spring': cardSpring.easing,
  '--card-spring-ms': ms(cardSpring.durationMs),

  '--t-arrow': ms(T.arrow),
  '--t-arrow-stage': ms(T.reveal - T.arrow),
  '--t-arrow-fade': ms(T.arrowFadeMs),
  '--t-outline-in': ms(T.outlineInMs),
  '--t-outline-out': ms(T.outlineOutMs),
  '--t-outline-out-delay': ms(T.outlineInMs + T.outlineHoldMs),
  '--t-fill-delay': ms(T.fillDelay),
  '--t-fill': ms(T.arrow - T.fillDelay),
  '--t-reveal': ms(T.reveal),
  '--t-reveal-ms': ms(T.revealMs),
  '--t-slogan': ms(T.slogan),
  '--t-slogan-ms': ms(T.shine - T.slogan),
  '--t-shine': ms(T.shine),
  '--t-shine-ms': ms(T.shineMs),
  '--t-reduced': ms(T.reducedMs),
  '--card-delay-base': ms(CARD_DELAY_MS),
  '--card-fade-ms': ms(CARD_FADE_MS),

  '--from-base-scale': String(FROM.baseScale),
  '--from-arrow-y': `${FROM.arrowY}px`,
  '--from-arrow-scale': String(FROM.arrowScale),
  '--from-glow-scale': String(FROM.glowScale),
  '--from-wordmark-y': `${FROM.wordmarkY}px`,
  '--from-card-rise': `${FROM.cardRise}px`,
} as CSSProperties
