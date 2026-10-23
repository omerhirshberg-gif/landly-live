import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert, AppState, Platform, Pressable, StyleSheet, View, type AppStateStatus } from 'react-native'
import Animated, { FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { signOut } from 'firebase/auth'
import { greetingKey, greetingPeriod } from '@shared/auth/greeting'
import { greetingName } from '@shared/auth/names'
import { auth } from '@shared/firebase/config'
import { useAuth } from '@shared/firebase/useAuth'
import { useMemberProfile } from '@shared/firebase/useMemberProfile'
import type { TranslationKey } from '@shared/i18n/translations'
import AppText from '../components/AppText'
import BiometricGlyph from '../components/BiometricGlyph'
import Button from '../components/Button'
import { StaticEmblem } from '../components/Emblem'
import Notice from '../components/Notice'
import { useLang } from '../i18n/LangProvider'
import { impact, success as successHaptic } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'
import {
  APP_LOCK_SUPPORTED,
  authenticate,
  biometricStatus,
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
// The lock screen greets the member by first name for the time of day above
// one card (the biometric glyph, "Unlock with Face ID" and the password
// link) and waits: the system prompt opens only when the member taps the
// button or the glyph (a light haptic either way), a cancelled prompt leaves
// the screen up to try again, and after three cancelled or failed tries a notice
// points to "Sign in with password instead", which signs out to the login
// screen with the email filled in. A sign-in made on the login screen is
// never locked: the member just proved who they are. Every unlock and
// sign-in here is still recorded on the device as the last entry.

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
 * root navigator. The system prompt opens only when the member taps the
 * glyph or the unlock button.
 */
export function AppLockOverlay() {
  const { t, ready: langReady } = useLang()
  const { user } = useAuth()
  const { profile } = useMemberProfile(user)
  const { status, locked, covered, tries, lockedAt, promptOpen, unlock, signInWithPasswordInstead } = useAppLock()
  const insets = useSafeAreaInsets()

  if (!locked && !covered) return null

  // Until the saved language is read, a lock shows the wordless cover, never English text.
  if (!locked || !langReady) {
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
  const face = kind === 'faceId' || kind === 'face'
  const exhausted = tries >= APP_LOCK_MAX_TRIES
  // Profile first, then the account's own name (on the device, so it works offline at launch).
  const name = greetingName(profile, user?.displayName)
  const greeting = t(greetingKey(greetingPeriod((lockedAt ?? new Date()).getHours()), !!name)).replace('{name}', name ?? '')
  const unlockTapped = () => {
    impact()
    unlock()
  }

  return (
    // Fades out on unlock (reduced motion: gone at once, Reanimated's default).
    <Animated.View exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, styles.lock]} accessibilityViewIsModal>
      <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.column}>
          <View style={styles.header}>
            <View style={styles.mark}>
              <StaticEmblem />
            </View>
            <AppText accessibilityRole="header" style={styles.greeting} numberOfLines={2}>
              {greeting}
            </AppText>
            <AppText style={styles.subtitle}>{t('applock_lockedSub').replace('{method}', method)}</AppText>
          </View>

          <View style={styles.card}>
            <View style={styles.glyph}>
              <BiometricGlyph kind={kind} pulsing={promptOpen} onPress={unlock} label={t('applock_glyphLabel').replace('{method}', method)} />
            </View>
            {exhausted && <Notice message={t('applock_tooMany')} />}
            <Button
              label={t('applock_unlockBtn').replace('{method}', method)}
              icon={face ? 'faceId' : 'fingerprint'}
              onPress={unlockTapped}
              busy={promptOpen}
              height={50}
            />
            <Pressable onPress={signInWithPasswordInstead} accessibilityRole="button" style={styles.link} hitSlop={8}>
              <AppText style={styles.linkText}>{t('applock_passwordInstead')}</AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  cover: { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  coverMark: { width: 72, height: 69 },
  lock: { backgroundColor: colors.background, zIndex: 1000 },
  // The header and card sit together in the middle (a 420px column on wide web windows).
  screen: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  column: { width: '100%', maxWidth: 420 },
  header: { alignItems: 'center', marginBottom: 28 },
  mark: { width: 52, height: 50, marginBottom: 20 },
  greeting: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: colors.heading, textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 12,
    gap: 16,
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px -12px rgba(15, 23, 42, 0.14)' },
      default: {
        shadowColor: colors.heading,
        shadowOpacity: 0.08,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      },
    }),
  },
  glyph: { alignItems: 'center', marginBottom: 8 },
  link: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 12, ...webOnly({ cursor: 'pointer' }) },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.brand, textAlign: 'center' },
})
