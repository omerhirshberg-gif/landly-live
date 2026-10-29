import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ENTRANCE_SPRING, glideToLockup, SPLASH_RELEASE_MS, splashGlideBackstopMs, T } from '@/lib/brand/entranceTimeline'

// A runtime-only import: a typed one would pull the app's @shared paths into the root typecheck.
const splashMotionPath = '../../landly-mobile/src/lib/splashMotion'
const { GLIDE, LOCK_RISE_PROGRESS } = (await import(splashMotionPath)) as {
  GLIDE: Record<'login' | 'lock', { duration: number; dampingRatio: number }>
  LOCK_RISE_PROGRESS: readonly [number, number]
}
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
  it('has the UI thread to itself: the screens mount only after it, the lock under it beforehand', async () => {
    const layout = await read('app/_layout.tsx')
    expect(layout).toContain('const screensUp = ready && introDone')
    // Gliding into the lock, the tabs wait until the splash is gone and JS is idle (landly-mobile/tests/splashGlide.test.ts).
    expect(layout).toContain("if (screensUp && !stackUp && handoff !== 'lock') setStackUp(true)")
    expect(layout).toMatch(/\{stackUp && \(\s*<Stack /)
    // The lock is laid out before the glide, never created on its first frames.
    expect(layout).toContain('const lockUp = ready')
    expect(layout).toContain('{lockUp && <AppLockOverlay settled={stackUp} />}')
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

  it('glides on one critically damped progress spring while the slogan fades, then crossfades onto the screen\'s own logo', async () => {
    expect(GLIDE).toEqual({ login: { duration: 620, dampingRatio: 1 }, lock: { duration: 700, dampingRatio: 1 } })
    expect(SPLASH_RELEASE_MS).toBe(140)
    // The card's rise (login.tsx, and the web) keeps its own spring.
    expect(ENTRANCE_SPRING).toEqual({ damping: 15, stiffness: 90 })
    const splash = await read('components/SplashScreen.tsx')
    expect(splash).toContain('const to = glideToLockup(from, target, LOCKUP_HEIGHT, LOCKUP_SCALE)')
    // Position and scale are read off one spring (landly-mobile/src/lib/splashMotion.ts), released near its end.
    expect(splash).toContain('p.set(withSpring(1, GLIDE[glideTo]))')
    expect(splash).toContain('{ scale: 1 + (toScale.get() - 1) * progress }')
    // Landed: in one UI-thread frame the screen's logo shows (`landed`) and the splash starts fading off it.
    expect(splash).toMatch(/if \(!arrived \|\| was\) return\s*p\.set\(1\)[^]*?landed\.set\(1\)\s*overlay\.set\(withTiming\(0, \{ duration: SPLASH_RELEASE_MS[^]*?scheduleOnRN\(release\)/)
    // The backstop's finish shows it and fades the splash itself.
    expect(splash).toMatch(/landed\.set\(1\)\s*setPhase\('done'\)\s*if \(!fading\) overlay\.set\(withTiming\(0, \{ duration: SPLASH_RELEASE_MS/)
    expect(splash).toContain('sloganFade.set(withTiming(0')
    // The lock's own lockup is shown by `landed` on the UI thread, never by a React render.
    const lock = await read('auth/AppLock.tsx')
    expect(lock).toContain('const lockupStyle = useAnimatedStyle(() => ({ opacity: landed.get() }))')
    expect(lock).not.toContain("phase !== 'done' && styles.hidden")
    expect(lock).toContain('lockupRef.current?.measureInWindow((x, y, width, height) => setLockRect({ x, y, width, height }))')
  })

  it('rises the hub, greeting and actions in off the glide’s own progress, on the UI thread', async () => {
    expect(LOCK_RISE.risePx).toBe(15)
    expect(LOCK_RISE_PROGRESS).toEqual([0.2, 0.85])
    const lock = await read('auth/AppLock.tsx')
    expect(lock.match(/<Rise reduced=\{reduced\}/g)).toHaveLength(2)
    expect(lock).toContain('Math.max(interpolate(glide.get(), LOCK_RISE_PROGRESS, [0, 1], Extrapolation.CLAMP), landed.get())')
    expect(lock).toContain('translateY: reduced ? 0 : LOCK_RISE.risePx * (1 - shown)')
    // No CSS transition keyed on a React phase change mid-glide.
    expect(lock).not.toContain('transitionProperty')
  })

  it('re-renders only the greeting when the member’s name arrives', async () => {
    const lock = await read('auth/AppLock.tsx')
    expect(lock).toContain('const LockGreeting = memo(function LockGreeting(')
    const overlay = lock.slice(lock.indexOf('export function AppLockOverlay'), lock.indexOf('function Rise('))
    expect(overlay).not.toContain('useMemberProfile')
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
    expect(splash).toContain('glideTimer.current = setTimeout(() => finish(false), GLIDE_MAX_MS)')
    // The backstop sits past both springs' settle (1.5x their perceptual duration), so it never cuts a glide short.
    expect(splash).toContain('const GLIDE_MAX_MS = splashGlideBackstopMs(Math.max(GLIDE.login.duration, GLIDE.lock.duration))')
    for (const { duration } of Object.values(GLIDE)) expect(splashGlideBackstopMs(duration)).toBeGreaterThanOrEqual(duration * 1.5 + 500)
    expect(splash).toMatch(/const finish = \(fading: boolean\) => \{\s*if \(finished\.current\) return\s*finished\.current = true/)
  })

  it('keeps the success haptic and the tap-only prompt', async () => {
    const lock = await read('auth/AppLock.tsx')
    expect(lock).toContain('successHaptic()')
    const overlay = lock.slice(lock.indexOf('export function AppLockOverlay'))
    expect(overlay.match(/unlock\(\)/g)).toHaveLength(1)
  })
})

describe('native launch screen', () => {
  it('holds in the canvas colour until the splash has drawn, then fades into it', async () => {
    const appJson = JSON.parse(await readFile(path.join('landly-mobile', 'app.json'), 'utf8'))
    const plugin = appJson.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')
    const theme = await read('theme.ts')
    expect(theme).toContain(`background: '${plugin[1].backgroundColor}'`)
    const layout = await read('app/_layout.tsx')
    expect(layout).toContain('NativeSplash.setOptions({ fade: true, duration: 200 })')
    expect(layout).toContain('NativeSplash.preventAutoHideAsync().catch(() => undefined)')
    const splash = await read('components/SplashScreen.tsx')
    expect(splash).toContain('onLayout={hideNativeSplash}')
  })
})
