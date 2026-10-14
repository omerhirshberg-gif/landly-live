import { describe, expect, it } from 'vitest'
import { ARROW_SPRING, ENTRANCE_SPRING, T, springProgress, springToCssLinear } from '@/lib/brand/entranceTimeline'

const points = (easing: string) => easing.slice('linear('.length, -1).split(', ').map(Number)

describe('entrance timeline', () => {
  it('keeps the four stages in order and back to back', () => {
    expect(T.arrow).toBe(1100)
    expect(T.reveal).toBe(1750)
    expect(T.shine).toBe(2300)
    expect(T.shine + T.shineMs).toBe(2950)
    expect(T.outlineInMs + T.outlineHoldMs + T.outlineOutMs).toBeLessThanOrEqual(T.arrow)
    expect(T.slogan).toBeGreaterThan(T.reveal)
  })

  it('starts springs at rest and settles them on the target', () => {
    for (const spring of [ARROW_SPRING, ENTRANCE_SPRING]) {
      expect(springProgress(spring, 0)).toBeCloseTo(0, 6)
      expect(springProgress(spring, 3)).toBeCloseTo(1, 3)
    }
  })

  it('handles critically and over-damped springs', () => {
    const critical = { damping: 20, stiffness: 100 }
    const over = { damping: 40, stiffness: 100 }
    for (const spring of [critical, over]) {
      expect(springProgress(spring, 0)).toBeCloseTo(0, 6)
      expect(springProgress(spring, 0.2)).toBeLessThanOrEqual(1)
      expect(springProgress(spring, 5)).toBeCloseTo(1, 3)
    }
  })

  it('turns the arrow spring into a CSS linear() curve that overshoots, like withSpring', () => {
    const { easing, durationMs } = springToCssLinear(ARROW_SPRING)
    const values = points(easing)
    expect(values[0]).toBe(0)
    expect(values.at(-1)).toBe(1)
    expect(Math.max(...values)).toBeGreaterThan(1.1)
    expect(values.every(Number.isFinite)).toBe(true)
    // Visibly done by the end of stage 2, fully at rest well before the intro ends.
    expect(durationMs).toBeGreaterThan(T.reveal - T.arrow)
    expect(durationMs).toBeLessThan(1500)
  })

  it('keeps the card spring gentle', () => {
    const values = points(springToCssLinear(ENTRANCE_SPRING).easing)
    expect(Math.max(...values)).toBeLessThan(1.05)
  })
})
