import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ARROW_SPRING, CARD_FADE_MS, ENTRANCE_SPRING, NATIVE_SPLASH_CLEARANCE_MS, NATIVE_SPLASH_FADE_MS, nativeSplashClearanceMs, SPLASH_HOLD_MS, T, springProgress, springToCssLinear } from '@/lib/brand/entranceTimeline'

const points = (easing: string) => easing.slice('linear('.length, -1).split(', ').map(Number)

describe('entrance timeline', () => {
  it('keeps the four stages in order and back to back', () => {
    expect(T.arrow).toBe(950)
    expect(T.reveal).toBe(1500)
    expect(T.shine).toBe(1950)
    // A crisp intro, then a 400ms hold and the 800ms glide: about 3.7s to a usable screen.
    expect(T.shine + T.shineMs).toBe(2550)
    expect(SPLASH_HOLD_MS).toBe(400)
    expect(T.shine + T.shineMs + SPLASH_HOLD_MS + 800).toBeLessThanOrEqual(3800)
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

  it('keeps the card spring gentle: damping 18, stiffness 70, no overshoot', () => {
    expect(ENTRANCE_SPRING).toEqual({ damping: 18, stiffness: 70 })
    expect(CARD_FADE_MS).toBe(520)
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

describe('native splash hand-off gate', () => {
  it('holds the intro until the native splash fade has cleared, longest on Android', () => {
    expect(nativeSplashClearanceMs('android')).toBe(260)
    expect(nativeSplashClearanceMs('ios')).toBe(120)
    expect(nativeSplashClearanceMs('web')).toBe(0)
    expect(nativeSplashClearanceMs('windows')).toBe(0)
    // Android's wait outlasts the 200ms hardware fade that _layout.tsx configures.
    expect(nativeSplashClearanceMs('android')).toBeGreaterThan(NATIVE_SPLASH_FADE_MS)
    expect(NATIVE_SPLASH_CLEARANCE_MS.web).toBe(0)
  })

  it('gates SplashScreen: go starts false, hides the native splash, then flips after two frames plus the clearance', () => {
    const src = readFileSync('landly-mobile/src/components/SplashScreen.tsx', 'utf8')
    expect(src).toContain('useState(false)')
    expect(src).not.toContain("useState(Platform.OS === 'web')")
    const hide = src.indexOf('NativeSplash.hide()')
    const frames = src.indexOf('requestAnimationFrame', hide)
    const clearance = src.indexOf('setTimeout(() => setGo(true), clearance)')
    expect(hide).toBeGreaterThan(-1)
    expect(frames).toBeGreaterThan(hide)
    expect(clearance).toBeGreaterThan(frames)
  })

  it('keeps the native fade length in _layout.tsx in step with the constant', () => {
    const layout = readFileSync('landly-mobile/src/app/_layout.tsx', 'utf8')
    expect(layout).toContain(`duration: ${NATIVE_SPLASH_FADE_MS}`)
  })
})
