import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { formatLastEntry, greetingKey, greetingPeriod, resolveLastEntry } from '@/lib/auth/greeting'
import { translations } from '@/lib/i18n/translations'

// biometricLock.ts reads the device through Expo (resolved from the app's own node_modules);
// the kind mapping only needs the enum.
vi.mock('../../landly-mobile/node_modules/react-native', () => ({ Platform: { OS: 'ios' } }))
vi.mock('../../landly-mobile/node_modules/expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0 }))
vi.mock('../../landly-mobile/node_modules/expo-local-authentication', () => ({ AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 } }))

const LANGS = Object.keys(translations) as (keyof typeof translations)[]
describe('time-of-day greeting', () => {
  it.each([
    [4, 'night'],
    [5, 'morning'],
    [11, 'morning'],
    [12, 'afternoon'],
    [17, 'afternoon'],
    [18, 'evening'],
    [21, 'evening'],
    [22, 'night'],
    [0, 'night'],
  ] as const)('%i:00 is %s', (hour, period) => {
    expect(greetingPeriod(hour)).toBe(period)
  })

  it('uses the boundary minutes as specified (04:59 night, 11:59 morning, 17:59 afternoon, 21:59 evening)', () => {
    for (const [h, m, period] of [[4, 59, 'night'], [11, 59, 'morning'], [17, 59, 'afternoon'], [21, 59, 'evening']] as const) {
      expect(greetingPeriod(new Date(2026, 9, 22, h, m).getHours())).toBe(period)
    }
  })

  it('greets by name, or without one', () => {
    expect(greetingKey('morning', true)).toBe('greet_morning')
    expect(greetingKey('night', false)).toBe('greet_night_noName')
  })

  it('has the agreed wording', () => {
    expect(translations.he.greet_morning).toBe('בוקר טוב, {name}')
    expect(translations.he.greet_afternoon).toBe('צהריים טובים, {name}')
    expect(translations.he.greet_evening).toBe('ערב טוב, {name}')
    expect(translations.he.greet_night).toBe('לילה טוב, {name}')
    expect(translations.ru.greet_night).toBe('Доброй ночи, {name}')
    // "Good night" / "Bonne nuit" read as goodbyes, so English and French say good evening at night.
    expect(translations.en.greet_night).toBe('Good evening, {name}')
    expect(translations.fr.greet_night).toBe('Bonsoir, {name}')
    expect(translations.he.applock_unlock).toBe('כניסה')
    expect(translations.en.applock_unlock).toBe('Unlock')
    expect(translations.he.applock_passwordInstead).toBe('כניסה באמצעות סיסמה')
    expect(translations.en.applock_passwordInstead).toBe('Sign in with password instead')
    expect(translations.he.applock_lastEntry).toBe('כניסה אחרונה: {time}')
  })

  it('is complete in every language', () => {
    const keys = [
      ...(['morning', 'afternoon', 'evening', 'night'] as const).flatMap((p) => [`greet_${p}`, `greet_${p}_noName`] as const),
      'applock_lastEntry',
      'applock_unlock',
      'applock_passwordInstead',
      'applock_glyphLabel',
    ] as const
    for (const lang of LANGS) {
      for (const key of keys) expect(translations[lang][key], `${lang}.${key}`).toBeTruthy()
      for (const p of ['morning', 'afternoon', 'evening', 'night'] as const) {
        expect(translations[lang][`greet_${p}`], `${lang}.greet_${p}`).toContain('{name}')
        expect(translations[lang][`greet_${p}_noName`], `${lang}.greet_${p}_noName`).not.toContain('{name}')
      }
    }
  })
})

describe('"Last sign-in"', () => {
  const at = new Date(2026, 9, 23, 17, 36)

  it('shows the numeric date and the time in the member language', () => {
    expect(formatLastEntry(at, 'he', false)).toBe('23.10.2026 17:36')
    expect(formatLastEntry(at, 'en', false)).toBe('10/23/2026 17:36')
    expect(formatLastEntry(at, 'fr', false)).toBe('23/10/2026 17:36')
    expect(translations.he.applock_lastEntry.replace('{time}', formatLastEntry(at, 'he', false))).toBe('כניסה אחרונה: 23.10.2026 17:36')
  })

  it('follows the device clock: a leading zero in 24-hour time, AM/PM in 12-hour time', () => {
    expect(formatLastEntry(new Date(2026, 9, 23, 9, 5), 'en', false)).toBe('10/23/2026 09:05')
    expect(formatLastEntry(new Date(2026, 9, 23, 0, 1), 'en')).toBe('10/23/2026 00:01')
    expect(formatLastEntry(at, 'en', true)).toMatch(/^10\/23\/2026 5:36\sPM$/)
  })

  it('prefers the entry stored on this device, then Firebase, then nothing', () => {
    expect(resolveLastEntry('2026-10-21T08:00:00.000Z', 'Mon, 01 Sep 2026 10:00:00 GMT')?.toISOString()).toBe('2026-10-21T08:00:00.000Z')
    expect(resolveLastEntry(null, 'Mon, 01 Sep 2026 10:00:00 GMT')?.toISOString()).toBe('2026-09-01T10:00:00.000Z')
    expect(resolveLastEntry('not a date', undefined)).toBeNull()
    expect(resolveLastEntry(null, null)).toBeNull()
  })
})

describe('lock screen wiring', () => {
  it('records each unlock and each sign-in here as the last entry, and shows the one before the lock', async () => {
    const src = await readFile('landly-mobile/src/auth/AppLock.tsx', 'utf8')
    expect(src).toContain('if (uid) recordLastEntry(uid)')
    expect(src).toContain('if (!launchSession || !on || !lastEntry) recordLastEntry(uid)')
    // Read when the lock engages, before the unlock records a new one.
    expect(src).toMatch(/if \(!locked \|\| !uid \|\| !APP_LOCK_SUPPORTED\) return\s*let cancelled = false\s*getLastEntry\(uid\)/)
    expect(src).toContain('const lastAt = resolveLastEntry(lastEntry, user?.metadata.lastSignInTime)')
    expect(src).toContain("t('applock_lastEntry')")
    expect(src).toContain("pointerEvents={leaving ? 'none' : 'auto'}")
  })

  it('keeps the entry device-only in the Keychain / Keystore', async () => {
    const src = await readFile('landly-mobile/src/auth/biometricLock.ts', 'utf8')
    expect(src).toContain('`landly.applock.lastEntry.${uid}`')
    expect(src).toContain('keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY')
  })

  it('waits for the saved language before the lock screen, its prompt and the login form', async () => {
    const lang = await readFile('landly-mobile/src/i18n/LangProvider.tsx', 'utf8')
    const lock = await readFile('landly-mobile/src/auth/AppLock.tsx', 'utf8')
    const layout = await readFile('landly-mobile/src/app/_layout.tsx', 'utf8')
    expect(lang).toContain('.finally(() => setReady(true))')
    expect(lang).toContain('AsyncStorage.setItem(STORAGE_KEY, next)')
    expect(lock).toContain('if (locked && langReady && !shown) setShown(true)')
    expect(layout).toContain('const known = langReady && !loading')
  })

  it('opens the system prompt only on a tap of the glyph or the unlock button', async () => {
    const lock = await readFile('landly-mobile/src/auth/AppLock.tsx', 'utf8')
    const overlay = lock.slice(lock.indexOf('export function AppLockOverlay'))
    // Its one effect plays the exit; nothing in it asks for biometrics.
    const effects = [...overlay.matchAll(/useEffect\(\(\) => \{[^]*?\n  \}, \[[^\]]*\]\)/g)].map((m) => m[0])
    expect(effects).toHaveLength(1)
    expect(effects[0]).not.toMatch(/unlock|authenticate|prompt/)
    expect(overlay.match(/unlock\(\)/g)).toHaveLength(1)
    expect(overlay).toContain('onPress={unlock}')
    expect(overlay).toContain('onPress={unlockTapped}')
  })

  it('plays the whole splash intro above the lock screen and the privacy cover', async () => {
    const splash = await readFile('landly-mobile/src/components/SplashScreen.tsx', 'utf8')
    const lock = await readFile('landly-mobile/src/auth/AppLock.tsx', 'utf8')
    const splashZ = Number(splash.match(/export const SPLASH_Z = (\d+)/)?.[1])
    const lockZ = [...lock.matchAll(/zIndex: (\d+)/g)].map((m) => Number(m[1]))
    expect(lockZ.length).toBeGreaterThanOrEqual(2)
    for (const z of lockZ) expect(splashZ).toBeGreaterThan(z)
    expect(splash).toContain('zIndex: SPLASH_Z,\n    elevation: SPLASH_Z,')
    // The hand-over waits for both the app and the full intro (star, arrow, wordmark, shine).
    expect(splash).toContain('if (!ready || !introDone || started.current) return')
    const { T } = await import('@/lib/brand/entranceTimeline')
    expect(T.shine + T.shineMs).toBeGreaterThanOrEqual(1800)
  })

  it('breathes the glyph only while waiting, and keeps it still with reduced motion', async () => {
    const glyph = await readFile('landly-mobile/src/components/BiometricGlyph.tsx', 'utf8')
    expect(glyph).toContain('if (!pulsing && !reduced) {')
    expect(glyph).toContain('const TILE = 96')
    expect(glyph).toContain('const BREATH_SCALE = 1.05')
    expect(glyph).toContain('const BREATH_MS = 1200')
    // The prompt's glow follows reduced motion too.
    expect(glyph).toContain('duration: reduced ? 0 : LIT_MS')
  })

  it('lays the lock screen out open, top to bottom: brand, glyph, greeting, last sign-in, actions', async () => {
    const lock = await readFile('landly-mobile/src/auth/AppLock.tsx', 'utf8')
    const overlay = lock.slice(lock.indexOf('export function AppLockOverlay'))
    const order = ['<BrandLockup scale={LOCKUP_SCALE} />', '<BiometricGlyph', '{greeting}', '{lastLine', "t('applock_unlock')", "t('applock_passwordInstead')"]
    const at = order.map((part) => overlay.indexOf(part))
    expect(at.every((i) => i > -1)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    // No card, no reassurance row; the emblem is about 1.6x the old 52pt mark.
    expect(overlay).not.toMatch(/styles\.card|protectedWith|name="shield"/)
    const hero = await readFile('landly-mobile/src/components/BrandHero.tsx', 'utf8')
    // A 120pt emblem: about 1.46x the earlier 82pt header.
    expect(hero).toContain('export const LOCKUP_SCALE = 120 / EMBLEM.width')
    expect(lock).toContain('paddingTop: insets.top + 36')
  })

  it('gives the unlock button an exact 50px height', async () => {
    const lock = await readFile('landly-mobile/src/auth/AppLock.tsx', 'utf8')
    expect(lock).toContain('height={50}')
  })

  it('fills in the email on the login form after "Sign in with password instead"', async () => {
    const lock = await readFile('landly-mobile/src/auth/AppLock.tsx', 'utf8')
    const login = await readFile('landly-mobile/src/app/(auth)/login.tsx', 'utf8')
    expect(lock).toContain('setPrefillEmail(auth.currentUser?.email ?? null)')
    expect(login).toContain("useState(() => prefillEmail ?? '')")
  })
})

describe('biometric kind', () => {
  const FINGER = 1
  const FACE = 2
  const IRIS = 3

  it('names the device hardware: Touch ID or Face ID on iOS, the one sensor on Android', async () => {
    // A runtime-only path: a typed import would pull React Native's globals (its FormData
    // has no get()) into the root typecheck.
    const path = '../../landly-mobile/src/auth/biometricLock'
    const { biometricKind } = (await import(path)) as { biometricKind: (types: number[], os: string) => string }
    expect(biometricKind([FINGER], 'ios')).toBe('touchId')
    expect(biometricKind([FACE], 'ios')).toBe('faceId')
    expect(biometricKind([], 'ios')).toBe('biometrics')
    expect(biometricKind([FINGER], 'android')).toBe('fingerprint')
    expect(biometricKind([FACE], 'android')).toBe('face')
    expect(biometricKind([IRIS], 'android')).toBe('iris')
    expect(biometricKind([FINGER, FACE], 'android')).toBe('biometrics')
    expect(biometricKind([], 'android')).toBe('biometrics')
  })

  it('shows the Face ID glyph only for a face, the fingerprint glyph otherwise', async () => {
    const lock = await readFile('landly-mobile/src/auth/AppLock.tsx', 'utf8')
    const glyph = await readFile('landly-mobile/src/components/BiometricGlyph.tsx', 'utf8')
    expect(glyph).toContain("const face = kind === 'faceId' || kind === 'face'")
    expect(glyph).toContain("face ? 'faceId' : 'fingerprint'")
    expect(lock).toContain('<BiometricGlyph kind={kind}')
    // The button says only "Unlock", so it never names the wrong method.
    expect(lock).not.toContain("icon={face ? 'faceId' : 'fingerprint'}")
  })

  it('names the detected method for screen readers in every language, never Face ID on a fingerprint device', () => {
    const glyphLabel = (lang: (typeof LANGS)[number], kind: 'touchId' | 'fingerprint') =>
      translations[lang].applock_glyphLabel.replace('{method}', translations[lang][`applock_method_${kind}`])
    expect(glyphLabel('he', 'fingerprint')).toBe('כניסה עם טביעת אצבע')
    expect(glyphLabel('en', 'touchId')).toBe('Sign in with Touch ID')
    for (const lang of LANGS) expect(glyphLabel(lang, 'fingerprint'), lang).not.toMatch(/Face ID|\{method\}/)
  })
})
