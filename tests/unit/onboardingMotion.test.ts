import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { springProgress, springToCssLinear } from '@/lib/brand/entranceTimeline'
import { CELEBRATE_SPRING, EASE_SILK, ONB, staggerDelay } from '@/lib/brand/onboardingMotion'

describe('onboarding motion', () => {
  it('moves cards slowly: arrivals within 400–550ms on the silk curve', () => {
    for (const ms of [ONB.stepInMs, ONB.langInMs, ONB.revealMs, ONB.screenOutMs, ONB.screenInMs, ONB.greetingMs, ONB.progressMs]) {
      expect(ms).toBeGreaterThanOrEqual(400)
      expect(ms).toBeLessThanOrEqual(550)
    }
    expect(EASE_SILK).toEqual([0.16, 1, 0.3, 1])
  })

  it('overlaps the outgoing and incoming cards', () => {
    expect(ONB.stepInDelayMs).toBeLessThan(ONB.stepOutMs)
    expect(staggerDelay(0)).toBe(ONB.stepInDelayMs)
    expect(staggerDelay(2)).toBe(ONB.stepInDelayMs + 2 * ONB.staggerMs)
  })

  it('lands the celebration badge without overshoot', () => {
    const { damping, stiffness } = CELEBRATE_SPRING
    expect(damping / (2 * Math.sqrt(stiffness))).toBeGreaterThanOrEqual(1)
    for (let t = 0; t <= 2; t += 0.01) expect(springProgress(CELEBRATE_SPRING, t)).toBeLessThanOrEqual(1 + 1e-9)
    const { durationMs } = springToCssLinear(CELEBRATE_SPRING)
    expect(durationMs).toBeGreaterThan(400)
    expect(durationMs).toBeLessThan(1200)
  })

  it('keeps reduced motion short', () => {
    expect(ONB.reducedMs).toBeLessThanOrEqual(250)
  })
})

// The 24px collapse: a stage sized from a measured card height (plus its
// 2 × 12px padding) locked shut whenever the reading came back 0. Both
// wizards must let the stage fit the current card on its own.
describe('onboarding stage sizing', () => {
  const read = (p: string) => readFileSync(join(__dirname, '../..', p), 'utf8')
  const webWizard = read('components/auth/onboarding/OnboardingWizard.tsx')
  const nativeWizard = read('landly-mobile/src/auth/onboarding/OnboardingWizard.tsx')
  const css = read('components/auth/entrance/entrance.module.css')
  const rule = (selector: string) => css.match(new RegExp(`^\\${selector} \\{([^}]*)\\}`, 'm'))?.[1] ?? ''

  it('never measures a card', () => {
    for (const src of [webWizard, nativeWizard]) {
      expect(src).not.toMatch(/ResizeObserver|onLayout|getBoundingClientRect|offsetHeight|useSharedValue|withTiming/)
    }
  })

  it('overlays the web cards in one grid cell and clips only the drift', () => {
    const stage = rule('.stage')
    expect(stage).toMatch(/display:\s*grid/)
    expect(stage).toMatch(/overflow-y:\s*visible/)
    expect(stage).not.toMatch(/(^|[^-])height:|overflow:\s*hidden/)
    expect(rule('.step')).toMatch(/grid-area:\s*1 \/ 1/)
    expect(css).not.toMatch(/transition:[^;]*\bheight\b/)
  })

  it('keeps the native card in flow', () => {
    expect(nativeWizard).not.toMatch(/position:\s*'absolute'/)
  })
})
