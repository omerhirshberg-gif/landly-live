import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppState, Pressable, StyleSheet, View, type AppStateStatus, type ViewStyle } from 'react-native'
import Animated, { cubicBezier, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { getCalendars } from 'expo-localization'
import { signOut } from 'firebase/auth'
import { appLockOn, entryExpired } from '@shared/auth/appLockPolicy'
import { formatLastEntry, greetingKey, greetingPeriod, resolveLastEntry } from '@shared/auth/greeting'
import { greetingName } from '@shared/auth/names'
import { LOCK_RISE, UNLOCK } from '@shared/brand/onboardingMotion'
import { auth } from '@shared/firebase/config'
import { useAuth } from '@shared/firebase/useAuth'
import { useMemberProfile } from '@shared/firebase/useMemberProfile'
import type { TranslationKey } from '@shared/i18n/translations'
import AppText from '../components/AppText'
import BiometricGlyph from '../components/BiometricGlyph'
import { BrandLockup, LOCKUP_SCALE } from '../components/BrandHero'
import Button from '../components/Button'
import { StaticEmblem } from '../components/Emblem'
import { useEntrance } from '../components/Entrance'
import Notice from '../components/Notice'
import { useLang } from '../i18n/LangProvider'
import { impact, success as successHaptic } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'
import {
  APP_LOCK_SUPPORTED,
  authenticate,
  biometricStatus,
  getAppLockSetting,
  getLastEntry,
  recordLastEntry,
  setAppLockEnabled,
  type BiometricKind,
  type BiometricStatus,
} from './biometricLock'

// The app lock (on by default wherever the device has biometrics set up; the
// member can turn it off in Privacy & Security): with it on, a session
// restored at launch, or one coming back after more than a minute in the
// background, waits behind the lock screen until Face ID / Touch ID / the
// fingerprint (or the device passcode) confirms the member. A saved session
// unused for more than 30 days (SESSION_MAX_IDLE_MS) ends at launch instead:
// the login form opens with the email filled in. The tabs stay mounted under
// it, so unlocking is instant. Whenever the app isn't active the privacy
// cover hides the screen, so the app switcher's snapshot never shows a pass.
// The lock screen greets the member by first name for the time of day above
// one card (the biometric glyph, "Unlock with Face ID" and the password
// link) and waits: the system prompt opens only when the member taps the
// button or the glyph (a light haptic either way), a cancelled prompt leaves
// the screen up to try again, and after three cancelled or failed tries a notice
// points to "Sign in with password instead", which signs out to the login
// screen with the email filled in. A sign-in made on the login screen is
// never locked: the member just proved who they are. Every unlock, sign-in
// here, and opening of the app unlocked is recorded on the device as the
// last entry, which restarts the 30-day clock.

/** Background time after which coming back asks again. */
export const APP_LOCK_GRACE_MS = 60_000
export const APP_LOCK_MAX_TRIES = 3

interface AppLockContextValue {
  /** Hardware, enrolment and the kind of biometrics; null until read (or on web). */
  status: BiometricStatus | null
  /** The lock is on for the signed-in member on this device. */
  enabled: boolean
  /** Turns the lock on or off after a successful biometric check; false if the member cancelled. */
  setEnabled: (on: boolean) => Promise<boolean>
  /** Reads hardware and enrolment again (after a visit to the device settings). */
  refreshStatus: () => Promise<void>
  /** "Sign out of all devices": the lock comes off for this account too. */
  clearForSignOutEverywhere: () => Promise<void>
  /** Whether the launch session's lock state has been read (the navigator waits for it). */
  known: boolean
  locked: boolean
  covered: boolean
  tries: number
  /** When the screen locked: the greeting is for that time of day. */
  lockedAt: Date | null
  /** The member's last entry on this device before the lock engaged (ISO), for "Last sign-in". */
  lastEntry: string | null
  /** The system prompt is open (the glyph's ring pulses). */
  promptOpen: boolean
  unlock: () => Promise<void>
  signInWithPasswordInstead: () => Promise<void>
  /** The email of the member who chose "Sign in with password instead", for the login form. */
  prefillEmail: string | null
  clearPrefillEmail: () => void
}

const AppLockContext = createContext<AppLockContextValue | null>(null)

export function methodKey(kind: BiometricKind): TranslationKey {
  return `applock_method_${kind}`
}

export function AppLockProvider({ children }: { children: ReactNode }) {
  const { t } = useLang()
  const { user, loading } = useAuth()
  const uid = user?.emailVerified ? user.uid : null
  const [status, setStatus] = useState<BiometricStatus | null>(null)
  const [enabledFor, setEnabledFor] = useState<{ uid: string; on: boolean } | null>(null)
  const [locked, setLocked] = useState(false)
  const [covered, setCovered] = useState(false)
  const [tries, setTries] = useState(0)
  const [lockedAt, setLockedAt] = useState<Date | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  const [lastEntry, setLastEntry] = useState<string | null>(null)
  const [prefillEmail, setPrefillEmail] = useState<string | null>(null)
  // The uid restored at launch (null: nobody); undefined until auth has loaded.
  const launchUid = useRef<string | null | undefined>(undefined)
  const backgroundedAt = useRef<number | null>(null)
  // The system prompt itself makes iOS report "inactive"; that's not leaving the app.
  const prompting = useRef(false)
  const enabled = !!uid && enabledFor?.uid === uid && enabledFor.on
  const enabledRef = useRef(enabled)
  const lockedRef = useRef(locked)
  const uidRef = useRef(uid)
  useEffect(() => {
    enabledRef.current = enabled
    lockedRef.current = locked
    uidRef.current = uid
  }, [enabled, locked, uid])

  // Declared before the flag read below, so it has run by the time that reads it.
  useEffect(() => {
    if (!loading && launchUid.current === undefined) launchUid.current = uid
  }, [loading, uid])

  const engageLock = useCallback(() => {
    setLocked(true)
    setLockedAt(new Date())
  }, [])

  // Read whenever the lock engages, before the unlock records a new one.
  useEffect(() => {
    if (!locked || !uid || !APP_LOCK_SUPPORTED) return
    let cancelled = false
    getLastEntry(uid).then((at) => {
      if (!cancelled) setLastEntry(at)
    })
    return () => {
      cancelled = true
    }
  }, [locked, lockedAt, uid])

  const refreshStatus = useCallback(async () => {
    if (!APP_LOCK_SUPPORTED) return
    setStatus(await biometricStatus())
  }, [])

  useEffect(() => {
    if (!APP_LOCK_SUPPORTED) return
    let cancelled = false
    biometricStatus().then((next) => {
      if (!cancelled) setStatus(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Each account's choice, the device's biometrics and its last entry, read
  // when it signs in. The launch session ends if it's been idle too long
  // (`known` stays false meanwhile, so the tabs never show), otherwise locks
  // at once if the lock is on; any other sign-in starts unlocked. (Signed
  // out, `enabled` is false, so a leftover lock never shows.)
  useEffect(() => {
    if (!uid || !APP_LOCK_SUPPORTED) return
    let cancelled = false
    Promise.all([getAppLockSetting(uid), biometricStatus(), getLastEntry(uid)]).then(([setting, current, lastEntry]) => {
      if (cancelled) return
      setStatus(current)
      const launchSession = launchUid.current === uid
      // Only the first read can be the launch session's.
      launchUid.current = null
      const on = appLockOn(setting, current)
      const proceed = () => {
        setEnabledFor({ uid, on })
        if (on && launchSession) engageLock()
        else setLocked(false)
        // A sign-in made here, or a launch with nothing to unlock (or no entry
        // yet), is an entry; a locked launch's comes with its unlock.
        if (!launchSession || !on || !lastEntry) recordLastEntry(uid)
      }
      if (launchSession && entryExpired(lastEntry, Date.now())) {
        setPrefillEmail(auth.currentUser?.email ?? null)
        signOut(auth).catch(proceed)
        return
      }
      proceed()
    })
    return () => {
      cancelled = true
    }
  }, [uid, engageLock])

  useEffect(() => {
    if (!APP_LOCK_SUPPORTED) return
    const onChange = (next: AppStateStatus) => {
      if (next === 'active') {
        setCovered(false)
        const away = backgroundedAt.current
        backgroundedAt.current = null
        if (enabledRef.current && away !== null && Date.now() - away > APP_LOCK_GRACE_MS) {
          setTries(0)
          engageLock()
        } else if (uidRef.current && !lockedRef.current) {
          // Back in the app unlocked: an entry, like a launch without the lock.
          recordLastEntry(uidRef.current)
        }
        refreshStatus()
        return
      }
      if (prompting.current) return
      setCovered(true)
      if (next === 'background' && backgroundedAt.current === null) backgroundedAt.current = Date.now()
    }
    const sub = AppState.addEventListener('change', onChange)
    return () => sub.remove()
  }, [refreshStatus, engageLock])

  const prompt = useCallback(
    async (promptMessage: string) => {
      prompting.current = true
      setPromptOpen(true)
      try {
        return await authenticate({ promptMessage, cancelLabel: t('applock_cancel'), fallbackLabel: t('applock_usePasscode') })
      } finally {
        prompting.current = false
        setPromptOpen(false)
      }
    },
    [t]
  )

  const unlock = useCallback(async () => {
    if (prompting.current) return
    const result = await prompt(t('applock_unlockPrompt'))
    if (result.success) {
      setLocked(false)
      setTries(0)
      successHaptic()
      if (uid) recordLastEntry(uid)
      return
    }
    // The system took the prompt away (another app, a call): not the member's try.
    if (result.error === 'app_cancel' || result.error === 'system_cancel') return
    // Locked out, or nothing left to check with: only the password route is left.
    const deadEnd = ['lockout', 'passcode_not_set', 'not_enrolled', 'not_available'].includes(result.error)
    setTries((n) => (deadEnd ? APP_LOCK_MAX_TRIES : n + 1))
  }, [prompt, t, uid])

  // The lock stays on for this account; the login form opens with its email filled in.
  // (A session idle for more than 30 days ends the same way, at launch.)
  const signInWithPasswordInstead = useCallback(async () => {
    setPrefillEmail(auth.currentUser?.email ?? null)
    setLocked(false)
    setTries(0)
    await signOut(auth).catch(() => {})
  }, [])

  const clearPrefillEmail = useCallback(() => setPrefillEmail(null), [])

  const setEnabled = useCallback(
    async (on: boolean) => {
      if (!uid) return false
      const current = await biometricStatus()
      setStatus(current)
      if (on && (!current.hardware || !current.enrolled)) return false
      const label = t(methodKey(current.kind))
      const result = await prompt(t(on ? 'applock_enablePrompt' : 'applock_disablePrompt').replace('{method}', label))
      if (!result.success) return false
      try {
        await setAppLockEnabled(uid, on)
      } catch {
        return false
      }
      setEnabledFor({ uid, on })
      if (on) successHaptic()
      return true
    },
    [uid, prompt, t]
  )

  // Recorded as the member's choice, so the next sign-in doesn't turn it back on by default.
  const clearForSignOutEverywhere = useCallback(async () => {
    if (!uid) return
    await setAppLockEnabled(uid, false).catch(() => {})
    setEnabledFor({ uid, on: false })
  }, [uid])

  // Known once the launch session's lock is decided (or there's nothing to read).
  const known = !loading && (!uid || !APP_LOCK_SUPPORTED || enabledFor?.uid === uid)

  return (
    <AppLockContext.Provider
      value={{
        status,
        enabled,
        setEnabled,
        refreshStatus,
        clearForSignOutEverywhere,
        known,
        locked: locked && enabled,
        covered: covered && enabled,
        tries,
        lockedAt,
        lastEntry,
        promptOpen,
        unlock,
        signInWithPasswordInstead,
        prefillEmail,
        clearPrefillEmail,
      }}
    >
      {children}
    </AppLockContext.Provider>
  )
}

export function useAppLock() {
  const ctx = useContext(AppLockContext)
  if (!ctx) throw new Error('useAppLock must be used within an AppLockProvider')
  return ctx
}

const RISE_EASE = cubicBezier(...UNLOCK.curve)
const UNLOCK_EASE = Easing.bezier(...UNLOCK.curve)
// However the exit animation ends, the lock screen is unmounted by then.
const EXIT_MAX_MS = UNLOCK.ms + 400

/**
 * The lock screen and the privacy cover, drawn above every screen by the
 * root navigator. The system prompt opens only when the member taps the
 * glyph or the unlock button.
 *
 * At launch it mounts under the splash, reports where its header lockup sits
 * (the splash logo glides onto it) and keeps the lockup hidden until the
 * splash is gone; the hub, greeting and actions rise in under the glide.
 */
export function AppLockOverlay() {
  const { t, lang, ready: langReady } = useLang()
  const { user } = useAuth()
  const { profile } = useMemberProfile(user)
  const { status, locked, covered, tries, lockedAt, lastEntry, promptOpen, unlock, signInWithPasswordInstead } = useAppLock()
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion()
  const { phase, setLockRect } = useEntrance()
  const lockupRef = useRef<View>(null)

  // The lock screen stays mounted through its exit: `shown` turns on with the
  // lock and off only once the exit has played (or the privacy cover takes
  // over), so it leaves as one piece, logo and all, and nothing of it stays
  // over the app. Leaving, it ignores touches.
  const [shown, setShown] = useState(false)
  if (locked && langReady && !shown) setShown(true)
  if (covered && !locked && shown) setShown(false)
  const leaving = shown && !locked
  const exit = useSharedValue(0)
  useEffect(() => {
    if (!leaving) {
      exit.set(0)
      return
    }
    // The dissolve and the drift: UNLOCK.ms on UNLOCK's curve, while the
    // screens under it rise in (_layout.tsx). Reduced motion: gone at once.
    const done = () => setShown(false)
    exit.set(withTiming(1, { duration: reduced ? 0 : UNLOCK.ms, easing: UNLOCK_EASE }, (fin) => fin && scheduleOnRN(done)))
    const timer = setTimeout(done, EXIT_MAX_MS)
    return () => clearTimeout(timer)
  }, [leaving, reduced, exit])
  const exitStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.get(),
    transform: [{ scale: 1 + (UNLOCK.scaleTo - 1) * exit.get() }],
  }))

  if (!shown) {
    if (!locked && !covered) return null
    // The privacy cover; until the saved language is read, a lock shows it too
    // (wordless, never English text first).
    return (
      <View style={[StyleSheet.absoluteFill, styles.cover]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.coverMark}>
          <StaticEmblem />
        </View>
      </View>
    )
  }

  const kind = status?.kind ?? 'biometrics'
  const method = t(methodKey(kind))
  const exhausted = tries >= APP_LOCK_MAX_TRIES
  // Profile first, then the account's own name (on the device, so it works offline at launch).
  const name = greetingName(profile, user?.displayName)
  const greeting = t(greetingKey(greetingPeriod((lockedAt ?? new Date()).getHours()), !!name)).replace('{name}', name ?? '')
  // The entry stored on this device, else Firebase's last sign-in; hidden without either.
  const lastAt = resolveLastEntry(lastEntry, user?.metadata.lastSignInTime)
  const uses24 = getCalendars()[0]?.uses24hourClock
  const lastLine = lastAt && t('applock_lastEntry').replace('{time}', formatLastEntry(lastAt, lang, uses24 == null ? undefined : !uses24))
  const unlockTapped = () => {
    impact()
    unlock()
  }
  // Under the splash, tell it where the lockup sits.
  const reportLockup = () => {
    if (phase === 'done') return
    lockupRef.current?.measureInWindow((x, y, width, height) => setLockRect({ x, y, width, height }))
  }
  const under = phase === 'splash'

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.lock, exitStyle]}
      pointerEvents={leaving ? 'none' : 'auto'}
      accessibilityViewIsModal={!leaving}
      accessibilityElementsHidden={leaving}
      importantForAccessibility={leaving ? 'no-hide-descendants' : 'auto'}
    >
      <AmbientGlow />
      <View style={[styles.screen, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.column}>
          {/* Top: the brand, where the splash logo lands (shown once the splash is gone). */}
          <View
            ref={lockupRef}
            collapsable={false}
            onLayout={reportLockup}
            style={[styles.brand, phase !== 'done' && styles.hidden]}
            accessible
            accessibilityRole="image"
            accessibilityLabel="Landly"
          >
            <BrandLockup scale={LOCKUP_SCALE} />
          </View>

          {/* Centre: the hub, the greeting and when the member last came in. */}
          <Rise under={under} reduced={reduced} style={styles.middle}>
            <BiometricGlyph kind={kind} pulsing={promptOpen} onPress={unlock} label={t('applock_glyphLabel').replace('{method}', method)} />
            <AppText accessibilityRole="header" style={styles.greeting} numberOfLines={2}>
              {greeting}
            </AppText>
            {lastLine && <AppText style={styles.lastEntry}>{lastLine}</AppText>}
          </Rise>

          {/* Bottom: unlock, then the password route. */}
          <Rise under={under} reduced={reduced} style={styles.actions}>
            {exhausted && <Notice message={t('applock_tooMany')} />}
            <Button label={t('applock_unlock')} onPress={unlockTapped} busy={promptOpen} height={50} />
            <Pressable onPress={signInWithPasswordInstead} accessibilityRole="button" style={styles.link} hitSlop={8}>
              <AppText style={styles.linkText}>{t('applock_passwordInstead')}</AppText>
            </Pressable>
          </Rise>
        </View>
      </View>
    </Animated.View>
  )
}

// Hidden under the splash, rising in as its logo glides up (a CSS transition,
// on the UI thread); already in place when the lock engages later.
function Rise({ under, reduced, style, children }: { under: boolean; reduced: boolean; style: ViewStyle; children: ReactNode }) {
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: under ? 0 : 1,
          transform: [{ translateY: under && !reduced ? LOCK_RISE.risePx : 0 }],
          transitionProperty: ['opacity', 'transform'],
          transitionDuration: LOCK_RISE.ms,
          transitionTimingFunction: RISE_EASE,
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}

// A soft brand light behind the lockup at the top; the hub carries its own
// (BiometricGlyph.tsx). A radial gradient, as React Native has no blur
// filter; static and symmetric, so RTL needs nothing.
const GLOW_HIGH = 360

function AmbientGlow() {
  return (
    <View pointerEvents="none" style={styles.glowLayer}>
      <Svg width={GLOW_HIGH} height={GLOW_HIGH} style={styles.glowHigh}>
        <Defs>
          <RadialGradient id="landlyLockGlowHigh" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#0066ff" stopOpacity={0.08} />
            <Stop offset="1" stopColor="#0066ff" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={GLOW_HIGH} height={GLOW_HIGH} fill="url(#landlyLockGlowHigh)" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  cover: { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  coverMark: { width: 72, height: 69 },
  lock: { backgroundColor: colors.background, zIndex: 1000 },
  // Full-bleed: brand at the top, the hub and greeting in the middle, the
  // actions at the bottom (a 420px column on wide web windows).
  screen: { flex: 1, paddingHorizontal: 24, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: 420 },
  // Room below the larger lockup before the hub's glow begins.
  brand: { alignItems: 'center', marginBottom: 16 },
  hidden: { opacity: 0 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  greeting: { fontSize: 28, lineHeight: 36, fontWeight: '700', letterSpacing: -0.3, color: colors.heading, textAlign: 'center', marginTop: 24 },
  lastEntry: { fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center', marginTop: 6, fontVariant: ['tabular-nums'] },
  actions: { gap: 8 },
  glowLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center' },
  glowHigh: { position: 'absolute', top: -140 },
  link: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 12, ...webOnly({ cursor: 'pointer' }) },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.brand, textAlign: 'center' },
})
