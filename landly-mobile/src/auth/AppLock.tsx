import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert, AppState, Pressable, StyleSheet, View, type AppStateStatus } from 'react-native'
import Animated, { FadeOut } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getCalendars } from 'expo-localization'
import { signOut } from 'firebase/auth'
import { formatLastEntry, greetingKey, greetingPeriod, resolveLastEntry } from '@shared/auth/greeting'
import { greetingName } from '@shared/auth/names'
import { auth } from '@shared/firebase/config'
import { useAuth } from '@shared/firebase/useAuth'
import { useMemberProfile } from '@shared/firebase/useMemberProfile'
import type { TranslationKey } from '@shared/i18n/translations'
import AppText from '../components/AppText'
import BiometricGlyph from '../components/BiometricGlyph'
import Button from '../components/Button'
import { StaticEmblem } from '../components/Emblem'
import LineIcon from '../components/LineIcon'
import Notice from '../components/Notice'
import { useLang } from '../i18n/LangProvider'
import { success as successHaptic } from '../lib/haptics'
import { colors } from '../theme'
import {
  APP_LOCK_SUPPORTED,
  authenticate,
  biometricStatus,
  getLastEntry,
  isAppLockEnabled,
  markAppLockOffered,
  recordLastEntry,
  setAppLockEnabled,
  wasAppLockOffered,
  type BiometricKind,
  type BiometricStatus,
} from './biometricLock'

// The app lock (opt-in, Privacy & Security): with it on, a session restored
// at launch, or one coming back after more than a minute in the background,
// waits behind the lock screen until Face ID / Touch ID / the fingerprint
// (or the device passcode) confirms the member. The tabs stay mounted under
// it, so unlocking is instant. Whenever the app isn't active the privacy
// cover hides the screen, so the app switcher's snapshot never shows a pass.
// The lock screen greets the member by first name for the time of day, shows
// when they last came in on this device, and opens the system prompt by
// itself once per lock; "Sign In" (or the glyph) tries again, and after three
// cancelled or failed tries a notice points to "Sign in with password
// instead", which signs out to the login screen with the email filled in. A
// sign-in made on the login screen is never locked: the member just proved
// who they are. Every unlock and sign-in here is recorded as the last entry.

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
  /** The one-time offer after a sign-in, when the device can and the member hasn't been asked. */
  offerAfterSignIn: () => void
  /** Whether the launch session's lock state has been read (the navigator waits for it). */
  known: boolean
  locked: boolean
  covered: boolean
  tries: number
  /** When the screen locked: the greeting is for that time of day. */
  lockedAt: Date | null
  /** The member's previous entry on this device, for "Last sign-in"; null hides the row. */
  lastEntry: Date | null
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
  const [lastEntry, setLastEntry] = useState<Date | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  const [prefillEmail, setPrefillEmail] = useState<string | null>(null)
  // The uid restored at launch (null: nobody); undefined until auth has loaded.
  const launchUid = useRef<string | null | undefined>(undefined)
  const backgroundedAt = useRef<number | null>(null)
  // The system prompt itself makes iOS report "inactive"; that's not leaving the app.
  const prompting = useRef(false)
  const enabled = !!uid && enabledFor?.uid === uid && enabledFor.on
  const enabledRef = useRef(enabled)
  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  // Declared before the flag read below, so it has run by the time that reads it.
  useEffect(() => {
    if (!loading && launchUid.current === undefined) launchUid.current = uid
  }, [loading, uid])

  const engageLock = useCallback(() => {
    setLocked(true)
    setLockedAt(new Date())
  }, [])

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

  // Each account's flag, read when it signs in; the launch session locks at
  // once if it's on, and any other sign-in starts unlocked. (Signed out,
  // `enabled` is false, so a leftover lock never shows.)
  useEffect(() => {
    if (!uid || !APP_LOCK_SUPPORTED) return
    let cancelled = false
    isAppLockEnabled(uid).then((on) => {
      if (cancelled) return
      setEnabledFor({ uid, on })
      const launchSession = launchUid.current === uid
      if (on && launchSession) engageLock()
      else setLocked(false)
      // A sign-in made here is an entry; the launch session's comes with its unlock.
      if (!launchSession) recordLastEntry(uid)
      // Only the first read can be the launch session's.
      launchUid.current = null
    })
    return () => {
      cancelled = true
    }
  }, [uid, engageLock])

  // What "Last sign-in" shows, read each time the screen locks (before this unlock is recorded).
  useEffect(() => {
    if (!locked || !uid) return
    let cancelled = false
    getLastEntry(uid).then((stored) => {
      if (cancelled) return
      const member = auth.currentUser
      setLastEntry(resolveLastEntry(stored, member?.uid === uid ? member.metadata.lastSignInTime : null))
    })
    return () => {
      cancelled = true
    }
  }, [locked, uid])

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

  const clearForSignOutEverywhere = useCallback(async () => {
    if (!uid) return
    await setAppLockEnabled(uid, false).catch(() => {})
    setEnabledFor({ uid, on: false })
  }, [uid])

  const offerAfterSignIn = useCallback(() => {
    if (!uid || !APP_LOCK_SUPPORTED) return
    const offeredUid = uid
    ;(async () => {
      const [current, offered, on] = await Promise.all([biometricStatus(), wasAppLockOffered(offeredUid), isAppLockEnabled(offeredUid)])
      setStatus(current)
      if (offered || on || !current.hardware || !current.enrolled) return
      await markAppLockOffered(offeredUid)
      if (auth.currentUser?.uid !== offeredUid) return
      const label = t(methodKey(current.kind))
      Alert.alert(t('applock_offerTitle').replace('{method}', label), t('applock_offerBody').replace('{method}', label), [
        { text: t('applock_offerNo'), style: 'cancel' },
        { text: t('applock_offerYes'), onPress: () => void setEnabled(true) },
      ])
    })()
  }, [uid, t, setEnabled])

  // Known once the launch session's flag is read (or there's nothing to read).
  const known = !loading && (!uid || !APP_LOCK_SUPPORTED || enabledFor?.uid === uid)

  return (
    <AppLockContext.Provider
      value={{
        status,
        enabled,
        setEnabled,
        refreshStatus,
        clearForSignOutEverywhere,
        offerAfterSignIn,
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

/**
 * The lock screen and the privacy cover, drawn above every screen by the
 * root navigator. `promptReady` (the splash has handed over) lets the system
 * prompt open by itself once per lock.
 */
export function AppLockOverlay({ promptReady }: { promptReady: boolean }) {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const { profile } = useMemberProfile(user)
  const { status, locked, covered, tries, lockedAt, lastEntry, promptOpen, unlock, signInWithPasswordInstead } = useAppLock()
  const autoPrompted = useRef(false)

  useEffect(() => {
    // Leaving the app (or unlocking) lets the prompt open by itself again next time.
    if (!locked || covered) {
      autoPrompted.current = false
      return
    }
    if (!promptReady || autoPrompted.current || tries >= APP_LOCK_MAX_TRIES) return
    autoPrompted.current = true
    unlock()
  }, [locked, promptReady, covered, tries, unlock])

  if (!locked && !covered) return null

  if (!locked) {
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
  // The device's 12/24-hour setting (unknown: the language's own convention).
  const clock24 = getCalendars()[0]?.uses24hourClock
  const hour12 = clock24 == null ? undefined : !clock24
  const lastEntryText = lastEntry ? t('applock_lastEntry').replace('{time}', formatLastEntry(lastEntry, new Date(), lang, t, hour12)) : null

  return (
    // Fades out on unlock (reduced motion: gone at once, Reanimated's default).
    <Animated.View exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, styles.lock]} accessibilityViewIsModal>
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <View style={styles.mark}>
            <StaticEmblem />
          </View>
          <AppText accessibilityRole="header" style={styles.greeting} numberOfLines={2}>
            {greeting}
          </AppText>
          {lastEntryText && (
            <View style={styles.lastEntry}>
              <LineIcon name="clock" size={14} color={colors.textMuted} />
              <AppText style={styles.lastEntryText}>{lastEntryText}</AppText>
            </View>
          )}
        </View>

        <View style={styles.hero}>
          <BiometricGlyph kind={kind} pulsing={promptOpen} onPress={unlock} label={t('applock_glyphLabel').replace('{method}', method)} />
        </View>

        <View style={styles.actions}>
          {exhausted && <Notice message={t('applock_tooMany')} />}
          <Button label={t('applock_signInBtn')} onPress={unlock} busy={promptOpen} large />
          <Pressable onPress={signInWithPasswordInstead} accessibilityRole="button" style={styles.link} hitSlop={8}>
            <AppText style={styles.linkText}>{t('applock_passwordInstead')}</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  cover: { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  coverMark: { width: 72, height: 69 },
  lock: { backgroundColor: colors.background, zIndex: 1000 },
  safe: { flex: 1, paddingHorizontal: 24 },
  top: { alignItems: 'center', paddingTop: 48 },
  mark: { width: 40, height: 38, marginBottom: 28 },
  greeting: { fontSize: 28, lineHeight: 36, fontWeight: '800', color: colors.heading, textAlign: 'center' },
  lastEntry: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  lastEntryText: { fontSize: 13, color: colors.textMuted },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { paddingBottom: 16 },
  link: { alignSelf: 'center', marginTop: 14, paddingVertical: 10, paddingHorizontal: 12 },
  linkText: { fontSize: 15, fontWeight: '700', color: colors.brand, textAlign: 'center' },
})
