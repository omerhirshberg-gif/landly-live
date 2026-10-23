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
const t = (key: 'applock_today' | 'applock_yesterday') => translations.en[key]

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
    expect(translations.he.applock_unlockBtn).toBe('כניסה עם {method}')
    expect(translations.he.applock_lockedSub).toBe('התחברו באמצעות {method} כדי להמשיך')
    expect(translations.he.applock_passwordInstead).toBe('התחברות באמצעות סיסמה')
    expect(translations.he.applock_lastEntry).toBe('כניסה אחרונה: {time}')
  })

  it('is complete in every language', () => {
    const keys = [
      ...(['morning', 'afternoon', 'evening', 'night'] as const).flatMap((p) => [`greet_${p}`, `greet_${p}_noName`] as const),
      'applock_lastEntry',
      'applock_today',
      'applock_yesterday',
      'applock_unlockBtn',
      'applock_lockedSub',
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
  const now = new Date(2026, 9, 22, 15, 30)

  it('says Today or Yesterday with the time, in the device clock style', () => {
    expect(formatLastEntry(new Date(2026, 9, 22, 9, 41), now, 'en', t, false)).toBe('Today, 09:41')
    expect(formatLastEntry(new Date(2026, 9, 21, 21, 10), now, 'en', t, false)).toBe('Yesterday, 21:10')
    expect(formatLastEntry(new Date(2026, 9, 22, 9, 41), now, 'en', t, true)).toMatch(/^Today, 9:41\sAM$/)
  })

  it('counts calendar days, not 24-hour spans', () => {
    // 23:59 the day before is "Yesterday", even though it's only 15h ago.
    expect(formatLastEntry(new Date(2026, 9, 21, 23, 59), now, 'en', t, false)).toBe('Yesterday, 23:59')
    // 00:01 today is "Today".
    expect(formatLastEntry(new Date(2026, 9, 22, 0, 1), now, 'en', t, false)).toBe('Today, 00:01')
  })

  it('shows a short date for older entries, with the year only when it differs', () => {
    const older = formatLastEntry(new Date(2026, 9, 18, 14, 5), now, 'en', t, false)
    expect(older).toMatch(/Oct/)
    expect(older).toMatch(/18/)
    expect(older).toMatch(/14:05/)
    expect(older).not.toMatch(/2026/)
    expect(formatLastEntry(new Date(2025, 11, 31, 8, 0), now, 'en', t, false)).toMatch(/2025/)
  })

  it('formats in the member language', () => {
    const he = (key: 'applock_today' | 'applock_yesterday') => translations.he[key]
    expect(formatLastEntry(new Date(2026, 9, 22, 9, 41), now, 'he', he, false)).toBe('היום, 09:41')
  })

  it('prefers the entry stored on this device, then Firebase, then nothing', () => {
    expect(resolveLastEntry('2026-10-21T08:00:00.000Z', 'Mon, 01 Sep 2026 10:00:00 GMT')?.toISOString()).toBe('2026-10-21T08:00:00.000Z')
    expect(resolveLastEntry(null, 'Mon, 01 Sep 2026 10:00:00 GMT')?.toISOString()).toBe('2026-09-01T10:00:00.000Z')
    expect(resolveLastEntry('not a date', undefined)).toBeNull()
    expect(resolveLastEntry(null, null)).toBeNull()
  })
})

describe('lock screen wiring', () => {
  it('records each unlock and each sign-in here as the last entry, without showing it on the lock screen', async () => {
    const src = await readFile('landly-mobile/src/auth/AppLock.tsx', 'utf8')
    expect(src).toContain('if (uid) recordLastEntry(uid)')
    expect(src).toContain('if (!launchSession) recordLastEntry(uid)')
    expect(src).not.toContain('applock_lastEntry')
    expect(src).toContain('exiting={FadeOut.duration(200)}')
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
    expect(lock).toContain('if (!locked || !langReady) {')
    expect(layout).toContain('const known = langReady && !loading')
  })

  it('opens the system prompt only on a tap of the glyph or the unlock button', async () => {
    const lock = await readFile('landly-mobile/src/auth/AppLock.tsx', 'utf8')
    const overlay = lock.slice(lock.indexOf('export function AppLockOverlay'))
    expect(overlay).not.toContain('useEffect')
    expect(overlay).toContain('onPress={unlock}')
    expect(overlay).toContain('onPress={unlockTapped}')
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
    for (const src of [lock, glyph]) {
      expect(src).toContain("const face = kind === 'faceId' || kind === 'face'")
      expect(src).toContain("face ? 'faceId' : 'fingerprint'")
    }
  })

  it('words the lock screen for the detected method in every language', () => {
    const lockScreen = (lang: (typeof LANGS)[number], kind: 'touchId' | 'fingerprint') => {
      const method = translations[lang][`applock_method_${kind}`]
      return [translations[lang].applock_lockedSub, translations[lang].applock_unlockBtn].map((s) => s.replace('{method}', method))
    }
    expect(lockScreen('he', 'fingerprint')).toEqual(['התחברו באמצעות טביעת אצבע כדי להמשיך', 'כניסה עם טביעת אצבע'])
    expect(lockScreen('en', 'fingerprint')).toEqual(['Unlock with fingerprint to continue', 'Unlock with fingerprint'])
    expect(lockScreen('en', 'touchId')).toEqual(['Unlock with Touch ID to continue', 'Unlock with Touch ID'])
    for (const lang of LANGS) {
      for (const line of lockScreen(lang, 'fingerprint')) expect(line, lang).not.toMatch(/Face ID|\{method\}/)
    }
  })
})
