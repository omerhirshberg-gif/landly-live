import { useEffect, useState } from 'react'
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { signOut, type User } from 'firebase/auth'
import { revokeAllSessions, type RevokeSessionsResult } from '@shared/account/revokeSessions'
import { orderSessions, type UserSession } from '@shared/account/sessionList'
import { watchSessions } from '@shared/account/sessions'
import { formatLastEntry } from '@shared/auth/greeting'
import { signInProvider, signInProviderCopy } from '@shared/auth/signInProvider'
import { auth } from '@shared/firebase/config'
import { useAuth } from '@shared/firebase/useAuth'
import { methodKey, useAppLock } from '../../auth/AppLock'
import AppText from '../../components/AppText'
import Button from '../../components/Button'
import ChangePassword from '../../components/ChangePassword'
import LineIcon from '../../components/LineIcon'
import Notice from '../../components/Notice'
import { ProviderGlyph } from '../../components/ProviderTile'
import ScreenHeader from '../../components/ScreenHeader'
import SettingsRow, { SettingsGroup } from '../../components/SettingsRow'
import { useLang } from '../../i18n/LangProvider'
import { API_BASE_URL } from '../../lib/env'
import { deviceSessionId, deviceSessionName, forgetSessionWrite } from '../../lib/deviceSession'
import { colors, radius } from '../../theme'

// Privacy & Security (web: app/settings/privacy-security/page.tsx): how the
// member signs in (password, Apple or Google, from the account's linked
// providers: lib/auth/signInProvider.ts), the app lock (where the device has
// biometrics; the website has Passkeys in this spot), Change Password for
// email/password accounts (an Apple or Google account has no Landly
// password, so it gets a note instead), the devices signed in, then the data
// controls. The account-deletion request itself stays in Settings' Danger zone.
export default function PrivacySecurityScreen() {
  const { t } = useLang()
  const { user } = useAuth()
  const provider = user ? signInProvider(user) : null
  const hasPassword = provider === 'password'

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('nav_security')} />
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {user && (
          <>
            <AppText accessibilityRole="header" style={styles.groupTitle}>{t('security_signin_title')}</AppText>
            <SignInMethod user={user} />

            <AppLockSection />

            {hasPassword && <ChangePassword user={user} />}

            <Sessions user={user} />

            <SettingsGroup title={t('security_data_title')}>
              <SettingsRow icon="lock" title={t('security_data_privacy')} onPress={() => router.push('/settings/privacy')} last />
            </SettingsGroup>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// "Unlock with Face ID" (or Touch ID / fingerprint, whatever the device has):
// on by default once biometrics are set up; the switch turns it on only
// after a successful biometric check, and asks
// again to turn off, so someone holding an unlocked phone can't quietly
// remove it. Hidden without biometric hardware; with hardware but nothing
// enrolled, the switch is disabled and the note links to the device settings
// (the status is read again when the app comes back to the foreground).
function AppLockSection() {
  const { t } = useLang()
  const { status, enabled, setEnabled } = useAppLock()
  const [busy, setBusy] = useState(false)
  if (!status?.hardware) return null

  const method = t(methodKey(status.kind))
  const icon = status.kind === 'faceId' || status.kind === 'face' ? 'faceId' : 'fingerprint'
  const toggle = async (on: boolean) => {
    setBusy(true)
    await setEnabled(on)
    setBusy(false)
  }

  return (
    <View>
      <AppText accessibilityRole="header" style={styles.groupTitle}>{t('applock_title')}</AppText>
      <View style={styles.card}>
        <View style={styles.device}>
          <View style={styles.lockIcon}>
            <LineIcon name={icon} color={colors.brand} />
          </View>
          <View style={styles.deviceText}>
            <AppText style={styles.value}>{t('applock_toggle').replace('{method}', method)}</AppText>
            <AppText style={styles.sub}>{t('applock_sub').replace('{method}', method)}</AppText>
          </View>
          <Switch
            value={enabled}
            onValueChange={toggle}
            disabled={busy || (!status.enrolled && !enabled)}
            accessibilityLabel={t('applock_toggle').replace('{method}', method)}
            trackColor={{ false: colors.border, true: colors.brand }}
            thumbColor={colors.white}
            ios_backgroundColor={colors.border}
          />
        </View>
        {!status.enrolled && (
          <View style={styles.enrol}>
            <AppText style={styles.note}>{t('applock_notEnrolled').replace('{method}', method)}</AppText>
            <Pressable onPress={() => Linking.openSettings()} accessibilityRole="link" hitSlop={8} style={styles.settingsLink}>
              <AppText style={styles.settingsLinkText}>{t('applock_openSettings')}</AppText>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  )
}

/** "Sign-in method": Apple or Google with its logo and why there's no password here, or Email & password. */
function SignInMethod({ user }: { user: User }) {
  const { t } = useLang()
  const provider = signInProvider(user)
  const { title, note } = signInProviderCopy(provider)
  const logo = provider === 'apple' || provider === 'google' ? provider : null
  return (
    <View style={styles.card}>
      <View style={styles.device}>
        {logo && (
          <View style={styles.providerIcon}>
            <ProviderGlyph provider={logo} appleColor={colors.heading} />
          </View>
        )}
        <View style={styles.deviceText}>
          <AppText style={styles.value}>{t(title)}</AppText>
          {!!user.email && <AppText ltr style={styles.email}>{user.email}</AppText>}
        </View>
      </View>
      {note && <AppText style={styles.note}>{t(note)}</AppText>}
    </View>
  )
}

// Every device signed in to the account (users/{uid}/sessions, written by
// each device: src/lib/deviceSession.ts on phones, the website for
// browsers), this phone first with its model, the others by their name and
// when they were last active; then "Sign out of all devices"
// (app/api/account/revoke-sessions), which also clears the list. The
// confirmation opens in place, as on the website; a success signs this
// device out too, which returns the app to the sign-in screen.
function Sessions({ user }: { user: User }) {
  const { t } = useLang()
  const { clearForSignOutEverywhere } = useAppLock()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<RevokeSessionsResult | null>(null)
  const sessions = useSessionList(user.uid)

  const revoke = async () => {
    setBusy(true)
    setResult(null)
    let outcome: RevokeSessionsResult
    try {
      outcome = await revokeAllSessions(await user.getIdToken(), API_BASE_URL)
    } catch {
      outcome = 'unauthorized'
    }
    // An already-revoked session has nothing left to end here either.
    if (outcome === 'done' || outcome === 'unauthorized') {
      forgetSessionWrite()
      await clearForSignOutEverywhere()
      await signOut(auth).catch(() => {})
      return
    }
    setResult(outcome)
    setBusy(false)
  }

  const error = result === 'rateLimited' ? t('del_rate_limited') : result ? t('security_signout_all_error') : null

  return (
    <View style={styles.sessions}>
      <AppText accessibilityRole="header" style={styles.groupTitle}>{t('security_sessions_title')}</AppText>
      <View style={styles.card}>
        {sessions.map((session, i) => (
          <View key={session.id} style={[styles.device, i > 0 && styles.deviceGap]}>
            <View style={[styles.deviceIcon, !session.current && styles.deviceIconOther]}>
              <LineIcon name={session.platform === 'web' ? 'monitor' : 'phone'} color={session.current ? colors.success : colors.textMuted} />
            </View>
            <View style={styles.deviceText}>
              <AppText style={styles.value} numberOfLines={1}>
                {session.current ? t('security_this_device_named').replace('{device}', isolate(session.deviceName)) : session.deviceName}
              </AppText>
              <AppText style={styles.sub}>
                {session.current || !session.lastActiveAt
                  ? t('security_this_device_sub')
                  : t('security_last_active').replace('{time}', isolate(formatLastEntry(session.lastActiveAt), 'ltr'))}
              </AppText>
            </View>
            {session.current && <View style={styles.dot} />}
          </View>
        ))}

        <View style={styles.divider} />

        {confirming ? (
          <View>
            <AppText style={styles.confirm}>{t('security_signout_all_confirm')}</AppText>
            <View style={styles.actions}>
              <View style={styles.action}>
                <Button label={t('del_cancel')} onPress={() => setConfirming(false)} disabled={busy} variant="secondary" />
              </View>
              <View style={styles.action}>
                <Button label={busy ? t('security_signout_all_busy') : t('security_signout_all_yes')} onPress={revoke} busy={busy} variant="danger" />
              </View>
            </View>
          </View>
        ) : (
          <Button
            label={t('security_signout_all')}
            onPress={() => {
              setResult(null)
              setConfirming(true)
            }}
            variant="secondary"
          />
        )}
        <AppText style={styles.hint}>{t('security_signout_all_sub')}</AppText>
        {error && (
          <View style={styles.error}>
            <Notice message={error} />
          </View>
        )}
      </View>
    </View>
  )
}

/**
 * Unicode isolates (FSI, or LRI for a date, … PDI): a device name or date
 * inside a Hebrew sentence keeps its own order, the app's <bdi>.
 */
const isolate = (text: string, dir: 'auto' | 'ltr' = 'auto') => `${dir === 'ltr' ? '\u2066' : '\u2068'}${text}\u2069`

/**
 * The listed devices, live. This phone is always first, named by its model
 * even before its own row has landed (or when the list can't be read).
 */
function useSessionList(uid: string): UserSession[] {
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [stored, setStored] = useState<UserSession[]>([])
  // Read once on opening, so the list doesn't reorder while it's open.
  const [now] = useState(() => Date.now())
  useEffect(() => {
    let cancelled = false
    void deviceSessionId().then((id) => !cancelled && setCurrentId(id))
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => (currentId ? watchSessions(uid, currentId, setStored) : undefined), [uid, currentId])

  const here: UserSession = stored.find((s) => s.current) ?? {
    id: currentId ?? 'this-device',
    deviceName: deviceSessionName(),
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    lastActiveAt: null,
    createdAt: null,
    current: true,
  }
  return orderSessions([here, ...stored.filter((s) => !s.current)], now)
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  // A centred column no wider than 640pt, so an unfolded foldable or a tablet
  // shows a settings page rather than rows stretched edge to edge.
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  groupTitle: { fontSize: 14, fontWeight: '600', color: colors.textFaint, marginBottom: 8, paddingHorizontal: 4 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 24,
  },
  value: { fontSize: 16, fontWeight: '600', color: colors.heading },
  email: { marginTop: 2, fontSize: 14, color: colors.body },
  note: { marginTop: 12, fontSize: 14, lineHeight: 20, color: colors.body },
  sessions: { marginTop: 24 },
  device: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deviceIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
  deviceIconOther: { backgroundColor: colors.borderLight },
  deviceGap: { marginTop: 14 },
  providerIcon: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  deviceText: { flex: 1, minWidth: 0 },
  sub: { marginTop: 1, fontSize: 13, color: colors.textMuted },
  lockIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  enrol: { marginTop: 4 },
  settingsLink: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  settingsLinkText: { fontSize: 14, fontWeight: '700', color: colors.brand },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 14 },
  confirm: { fontSize: 15, fontWeight: '600', color: colors.heading, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
  hint: { marginTop: 10, fontSize: 13, color: colors.textMuted },
  error: { marginTop: 12 },
})
