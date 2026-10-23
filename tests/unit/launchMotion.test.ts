import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ENTRANCE_SPRING, glideToLockup, LOCK_GLIDE_SPRING, T } from '@/lib/brand/entranceTimeline'
import { LOCK_RISE, UNLOCK } from '@/lib/brand/onboardingMotion'

const read = (file: string) => readFile(path.join('landly-mobile/src', file), 'utf8')

async function sources(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((e) => (e.isDirectory() ? sources(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []))
  )
  return nested.flat()
}

describe('splash intro', () => {
  it('has the UI thread to itself: the screens and the lock mount only after it', async () => {
    const layout = await read('app/_layout.tsx')
    expect(layout).toContain('const screensUp = ready && introDone')
    expect(layout).toMatch(/\{screensUp && \(\s*<Stack /)
    expect(layout).toContain('{screensUp && <AppLockOverlay />}')
    expect(layout).toContain('<SplashScreen ready={screensUp} handoff={handoff} onIntroDone={handleIntroDone}')
    // The splash still waits for both before handing over.
    expect(await read('components/SplashScreen.tsx')).toContain('if (!ready || !introDone || started.current) return')
  })

  it('starts every stage once, on mount, and never re-renders the emblem mid-intro', async () => {
    const hero = await read('components/BrandHero.tsx')
    expect(hero.match(/useEffect\(/g)).toHaveLength(1)
    expect(hero).toContain('export default memo(function BrandHero(')
    expect(T.shine + T.shineMs).toBe(2950)
  })

  it('passes Reanimated easing objects, never CSS easing strings', async () => {
    for (const file of await sources('landly-mobile/src')) {
      const src = await readFile(file, 'utf8')
      for (const match of src.matchAll(/(transition|animation)TimingFunction:\s*['"`]|easing:\s*['"`]/g)) {
        // Plain CSS for the browser's DOM (webOnly styles, e.g. TextField's zoom) never reaches Reanimated.
        const before = src.slice(0, match.index)
        const inWebOnly = before.lastIndexOf('webOnly({') > before.lastIndexOf('})')
        expect(inWebOnly, `${file}: ${match[0]}`).toBe(true)
      }
    }
  })
})

describe('splash logo into the app lock', () => {
  it('lands the scaled lockup exactly on the header', () => {
    const lockupHeight = 151
    const scale = 82 / 112
    const from = { x: 67, y: 330, width: 240, height: 173 }
    const target = { x: 99.1, y: 75, width: 240 * scale, height: lockupHeight * scale }
    const to = glideToLockup(from, target, lockupHeight, scale)
    // Where the lockup's centre ends up after scaling about the hero's centre, then translating.
    const cx = from.x + from.width / 2
    const cy = from.y + from.height / 2
    const lockupCenter = { x: cx, y: from.y + lockupHeight / 2 }
    const landed = { x: cx + (lockupCenter.x - cx) * scale + to.x, y: cy + (lockupCenter.y - cy) * scale + to.y }
    expect(landed.x).toBeCloseTo(target.x + target.width / 2, 6)
    expect(landed.y).toBeCloseTo(target.y + target.height / 2, 6)
  })

  it('glides on its damped spring while the slogan fades, then hands over in one frame', async () => {
    expect(LOCK_GLIDE_SPRING).toEqual({ damping: 16, stiffness: 120 })
    expect(ENTRANCE_SPRING).toEqual({ damping: 15, stiffness: 90 })
    const splash = await read('components/SplashScreen.tsx')
    expect(splash).toContain('const to = glideToLockup(from, target, LOCKUP_HEIGHT, LOCKUP_SCALE)')
    expect(splash).toContain('scale.set(withSpring(LOCKUP_SCALE, LOCK_GLIDE_SPRING))')
    expect(splash).toContain('sloganFade.set(withTiming(0')
    // The lock's own lockup shows only once the splash is gone (same commit as its removal).
    const lock = await read('auth/AppLock.tsx')
    expect(lock).toContain("style={[styles.brand, phase !== 'done' && styles.hidden]}")
    expect(lock).toContain('lockupRef.current?.measureInWindow((x, y, width, height) => setLockRect({ x, y, width, height }))')
  })

  it('rises the hub, greeting and actions in under the glide', async () => {
    expect(LOCK_RISE).toEqual({ ms: 520, risePx: 15 })
    const lock = await read('auth/AppLock.tsx')
    expect(lock).toContain("const under = phase === 'splash'")
    expect(lock.match(/<Rise under=\{under\} reduced=\{reduced\}/g)).toHaveLength(2)
    expect(lock).toContain('translateY: under && !reduced ? LOCK_RISE.risePx : 0')
  })

  it('sends the logo to the lock only when the launch is locked', async () => {
    const layout = await read('app/_layout.tsx')
    expect(layout).toContain("const handoff: Handoff = !signedIn ? 'login' : locked ? 'lock' : 'none'")
  })
})

describe('tab bar boundary', () => {
  it('keeps the iOS bar material and hairline before iOS 26, and leaves Liquid Glass alone', async () => {
    const tabs = await read('app/(tabs)/_layout.tsx')
    expect(tabs).toContain("Platform.OS === 'ios' && iosVersion < 26")
    expect(tabs).toContain("{ disableTransparentOnScrollEdge: true, blurEffect: 'systemChromeMaterial' as const, shadowColor: colors.border }")
    expect(tabs).toContain('<NativeTabs tintColor={colors.brand} {...androidBar} {...iosEdgeBar}>')
  })

  it('draws a hairline over the Android bar on its surfaceContainer', async () => {
    const tabs = await read('app/(tabs)/_layout.tsx')
    expect(tabs).toContain('backgroundColor: colors.surfaceContainer')
    expect(tabs).toContain('bottom: ANDROID_BAR_HEIGHT + insets.bottom')
    expect(tabs).toContain('height: StyleSheet.hairlineWidth, backgroundColor: colors.border')
    expect(tabs).toMatch(/<View pointerEvents="none" style=\{\[styles\.androidDivider/)
  })

  it('keeps the web bar white with a border line', async () => {
    const web = await read('app/(tabs)/_layout.web.tsx')
    expect(web).toContain("bar: { direction: 'ltr', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border }")
  })
})

describe('unlock into the app', () => {
  it('takes 1.5s on one curve: the lock dissolves to 1.02 throughout, the screens rise 16pt from 300ms', async () => {
    expect(UNLOCK).toEqual({ ms: 1500, revealDelayMs: 300, curve: [0.16, 1, 0.3, 1], risePx: 16, scaleTo: 1.02 })
    const lock = await read('auth/AppLock.tsx')
    expect(lock).toContain('exit.set(withTiming(1, { duration: reduced ? 0 : UNLOCK.ms, easing: UNLOCK_EASE }, (fin) => fin && scheduleOnRN(done)))')
    expect(lock).toContain('transform: [{ scale: 1 + (UNLOCK.scaleTo - 1) * exit.get() }]')
    const layout = await read('app/_layout.tsx')
    expect(layout).toContain('if (locked) reveal.set(0)')
    expect(layout).toContain('const ms = UNLOCK.ms - UNLOCK.revealDelayMs')
    expect(layout).toContain('reveal.set(withDelay(UNLOCK.revealDelayMs, withTiming(1, { duration: ms, easing: UNLOCK_EASE })))')
    expect(layout).toContain('transform: [{ translateY: UNLOCK.risePx * (1 - reveal.get()) }]')
  })

  it('fades the screens in by lifting a veil, never by their own opacity (the tab bar glass needs alpha 1)', async () => {
    const layout = await read('app/_layout.tsx')
    expect(layout).toContain('const riseStyle = useAnimatedStyle(() => ({ transform: [{ translateY: UNLOCK.risePx * (1 - reveal.get()) }] }))')
    expect(layout).toContain('const veilStyle = useAnimatedStyle(() => ({ opacity: 1 - reveal.get() }))')
    expect(layout).toContain('<Animated.View pointerEvents="none" style={[styles.veil, veilStyle]} />')
    expect(layout).not.toMatch(/opacity: reveal\.get\(\)/)
  })

  it('leaves nothing over the app: the lock unmounts after its exit, the splash after its glide', async () => {
    const lock = await read('auth/AppLock.tsx')
    expect(lock).not.toContain('exiting=')
    expect(lock).toContain('const leaving = shown && !locked')
    expect(lock).toContain('const timer = setTimeout(done, EXIT_MAX_MS)')
    expect(lock).toContain("pointerEvents={leaving ? 'none' : 'auto'}")
    const splash = await read('components/SplashScreen.tsx')
    expect(splash).toContain('glideTimer.current = setTimeout(finish, GLIDE_MAX_MS)')
    expect(splash).toMatch(/const finish = \(\) => \{\s*if \(finished\.current\) return\s*finished\.current = true/)
  })

  it('keeps the success haptic and the tap-only prompt', async () => {
    const lock = await read('auth/AppLock.tsx')
    expect(lock).toContain('successHaptic()')
    const overlay = lock.slice(lock.indexOf('export function AppLockOverlay'))
    expect(overlay.match(/unlock\(\)/g)).toHaveLength(1)
  })
})
