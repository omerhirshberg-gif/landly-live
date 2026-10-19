import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
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

describe('web auth intro', () => {
  const screen = readFileSync('components/auth/entrance/AuthScreen.tsx', 'utf8')
  const css = readFileSync('components/auth/entrance/entrance.module.css', 'utf8')

  it('plays on every arrival at /login or /signup, with no once-per-session gate', () => {
    expect(screen).not.toContain('landly_auth_intro_seen')
    expect(screen).not.toContain('sessionStorage')
    expect(screen).toMatch(/useEffect\(\(\) => \{\s*setEntrance\('intro'\)\s*\}, \[\]\)/)
  })

  it('glows softly behind the emblem, peaking with the shine and settling faint', () => {
    expect(readFileSync('components/auth/entrance/BrandHero.tsx', 'utf8')).toContain('<span aria-hidden="true" className={styles.glow} />')
    expect(css).toMatch(/\.glow \{[^}]*radial-gradient\(closest-side, rgba\(0, 56, 184, 0\.1\), rgba\(0, 56, 184, 0\)\);[^}]*opacity: 0\.4;/)
    expect(css).toContain('animation: landlyGlow calc(var(--t-shine) + var(--t-shine-ms)) var(--ease-in-out) both;')
    expect(css).toContain('100% { opacity: 0.4; transform: scale(1); }')
  })

  it('gives the app the same glow, on the shared timeline', () => {
    const app = readFileSync('landly-mobile/src/components/BrandHero.tsx', 'utf8')
    expect(app).toContain('const GLOW_TOTAL = T.shine + T.shineMs')
    expect(app).toContain('const GLOW_REST = 0.4')
    expect(app).toContain('<RadialGradient id="landlyGlow"')
  })
})
