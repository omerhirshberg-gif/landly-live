import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GLIDE, glideRemainingPx, LOCK_GUTTER, LOCK_LAYOUT_WAIT_MS, LOCK_TOP_GAP, lockupTarget, RELEASE_PX, RETARGET_SPRING } from '../src/lib/splashMotion'

const read = (path: string) => readFileSync(`landly-mobile/src/${path}`, 'utf8')
const LOCKUP = { width: 120, height: 150 }

describe('lockupTarget', () => {
  it('centres the lockup under the top inset, as the lock screen lays it out', () => {
    const box = lockupTarget({ width: 393 }, { top: 59, left: 0, right: 0 }, LOCKUP)
    expect(box).toEqual({ x: (393 - 120) / 2, y: 59 + 36, width: 120, height: 150 })
  })

  it('centres between uneven side insets (landscape notch, foldables)', () => {
    const box = lockupTarget({ width: 852 }, { top: 0, left: 59, right: 0 }, LOCKUP)
    const start = 59 + LOCK_GUTTER
    const content = 852 - start - LOCK_GUTTER
    expect(box.x).toBe(start + (content - 120) / 2)
    expect(box.y).toBe(LOCK_TOP_GAP)
  })

  it('matches the lock screen’s own padding', () => {
    const lock = read('auth/AppLock.tsx')
    expect(lock).toContain(`paddingTop: insets.top + ${LOCK_TOP_GAP}`)
    expect(lock).toContain(`paddingLeft: insets.left + ${LOCK_GUTTER}, paddingRight: insets.right + ${LOCK_GUTTER}`)
    expect(lock).toContain('style={styles.brand}')
    expect(lock).toContain("brand: { alignItems: 'center',")
  })
})

describe('the splash glide', () => {
  it('lands without an overshoot and hands over before the spring’s tail', () => {
    for (const spring of [GLIDE.login, GLIDE.lock, RETARGET_SPRING]) expect(spring.dampingRatio).toBe(1)
    expect(RELEASE_PX).toBe(0.5)
  })

  it('hands over by distance left, not a share of progress, so a long glide never leaves a visible offset', () => {
    // 99.5% of a 300pt glide still had 1.5pt to go; the release waits for under half a point.
    expect(glideRemainingPx(0.995, 0, -300, 0, 240)).toBeCloseTo(1.5, 6)
    expect(glideRemainingPx(0.999, 0, -300, 0, 240)).toBeLessThan(RELEASE_PX)
    // A shrinking logo counts too: its edge still moving by (1 - scale) x width.
    expect(glideRemainingPx(0.998, 0, 0, -0.27, 240)).toBeGreaterThan(0.1)
    expect(glideRemainingPx(1, 120, -300, -0.27, 240)).toBe(0)
  })

  it('drives translation, scale and backdrop off one progress spring', () => {
    const splash = read('components/SplashScreen.tsx')
    expect(splash).toContain('p.set(withSpring(1, GLIDE[glideTo]))')
    // `p` is the entrance's shared value, read by the lock screen's rise too.
    expect(splash).toContain('const { phase, heroRect, lockRect, setPhase, glide: p, landed } = useEntrance()')
    expect(splash).toContain('{ translateX: toX.get() * progress }')
    expect(splash).toContain('{ scale: 1 + (toScale.get() - 1) * progress }')
    expect(splash).toContain('interpolate(p.get(), [BACKDROP_OUT[0], BACKDROP_OUT[1]], [1, 0], Extrapolation.CLAMP)')
    // No separate x / y / scale springs that could drift apart.
    expect(splash).not.toMatch(/\b(tx|ty|scale)\.set\(/)
  })

  it('waits for the lock to report its spot (or, late, predicts it), then a frame, and bends to a newer one', () => {
    const splash = read('components/SplashScreen.tsx')
    expect(splash).toContain('const lockTarget = lockRect ?? (lockWaitOver ? lockupTarget(window, insets, LOCKUP_BOX) : null)')
    expect(splash).toContain('setTimeout(() => setLockWaitOver(true), LOCK_LAYOUT_WAIT_MS)')
    expect(LOCK_LAYOUT_WAIT_MS).toBeLessThanOrEqual(250)
    // The spring starts a frame after the spot is known, so nothing mounted with it is still being created.
    expect(splash).toMatch(/const frame = requestAnimationFrame\(\(\) => \{[^]*?p\.set\(withSpring\(1, GLIDE\[glideTo\]\)\)\s*\}\)\s*return \(\) => cancelAnimationFrame\(frame\)/)
    expect(splash).toContain('toX.set(withSpring(to.x, RETARGET_SPRING))')
    expect(splash).toContain('glideRemainingPx(p.get(), toX.get(), toY.get(), toScale.get() - 1, HERO.width) < RELEASE_PX')
    expect(splash).toContain('Math.abs(toX.get() - goalX.get()) < RELEASE_PX')
    // Settled exactly onto the spot as it hands over: the two logos crossfade pixel on pixel.
    expect(splash).toMatch(/if \(!arrived \|\| was\) return\s*p\.set\(1\)\s*toX\.set\(goalX\.get\(\)\)\s*toY\.set\(goalY\.get\(\)\)\s*landed\.set\(1\)/)
  })

  it('keeps the login hero still under the glide and reports every move of it', () => {
    const login = read('app/(auth)/login.tsx')
    // The Apple button's row is there from the first frame on iOS, so the card never grows under a landed logo.
    expect(login).toContain("const [appleAvailable, setAppleAvailable] = useState(Platform.OS === 'ios')")
    // The hero, the card under it and the screen's frame all re-measure; an unchanged spot is dropped.
    expect(login).toContain("onLayout={reportHero}\n                style={[styles.header, phase !== 'done' && styles.hidden]}")
    expect(login).toContain('riseStyle]} onLayout={reportHero}>')
    expect(login).toContain("behavior={Platform.OS === 'ios' ? 'padding' : undefined} onLayout={reportHero}>")
    expect(login).toContain('if (key === lastHeroRect.current) return')
  })

  it('mounts the tabs once the splash is gone and JS is idle when it glides into the lock', () => {
    const layout = read('app/_layout.tsx')
    expect(layout).toContain("if (stackUp || !screensUp || handoff !== 'lock' || !splashDone) return")
    expect(layout).toContain('return whenIdle(() => setStackUp(true))')
    expect(layout).toMatch(/\{stackUp && \(\s*<Stack /)
    expect(layout).toContain('{lockUp && <AppLockOverlay settled={stackUp} />}')
    // The hub holds its breath until then.
    expect(read('auth/AppLock.tsx')).toContain('breathing={settled}')
    expect(read('components/BiometricGlyph.tsx')).toContain('if (!pulsing && !reduced && breathing) {')
  })

  it('measures the glide on device in development builds only', () => {
    const splash = read('components/SplashScreen.tsx')
    expect(splash).toContain('useGlideFrameProbe(p, handoff)')
    expect(read('lib/useGlideFrameProbe.ts')).toContain('}, __DEV__)')
  })
})
