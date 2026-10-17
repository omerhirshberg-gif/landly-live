import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View, type TextInput } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, type User } from 'firebase/auth'
import { isStrongPassword } from '@shared/auth/passwordValidation'
import { getAuthErrorMessage } from '@shared/firebase/authErrors'
import AppText from './AppText'
import Button from './Button'
import Notice from './Notice'
import TextField from './TextField'
import PasswordRequirements from '../auth/onboarding/PasswordRequirements'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

const SUCCESS_NOTICE_MS = 4000

// The "Change Password" card in the Privacy & Security sheet (email/password
// members only; the sheet shows a note otherwise). Collapsed to one row; opened, it asks for the
// current password, then a new one that passes the sign-up rule (the
// checklist ticks while the field is focused). Same Firebase steps as the
// website's components/settings/SecuritySection.tsx: re-authenticate with the
// current password, then update it.
export default function ChangePassword({ user }: { user: User }) {
  const { t, isRtl } = useLang()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [nextFocused, setNextFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const nextRef = useRef<TextInput>(null)

  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => setDone(false), SUCCESS_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [done])

  const reset = () => {
    setCurrent('')
    setNext('')
    setError(null)
  }

  const toggle = () => {
    if (busy) return
    if (open) reset()
    setDone(false)
    setOpen((v) => !v)
  }

  const submit = async () => {
    if (!current || !next) return
    if (!isStrongPassword(next)) {
      setError(t('onb_passwordWeak'))
      return
    }
    if (!user.email) {
      setError(getAuthErrorMessage(null))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current))
      await updatePassword(user, next)
      reset()
      setOpen(false)
      setDone(true)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        <AppText style={styles.title}>{t('profile_change_password_title')}</AppText>
        <Svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.textFaint}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          // Closed: points the reading direction; open: points down.
          style={{ transform: [{ rotate: open ? '90deg' : isRtl ? '180deg' : '0deg' }] }}
        >
          <Path d="m9 6 6 6-6 6" />
        </Svg>
      </Pressable>

      {done && !open && <Notice message={t('profile_password_success')} tone="success" />}

      {open && (
        <View style={styles.form}>
          <TextField
            label={t('profile_current_password_label')}
            icon="lock"
            value={current}
            onChangeText={(v) => {
              setCurrent(v)
              setError(null)
            }}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="next"
            onSubmitEditing={() => nextRef.current?.focus()}
            autoFocus
          />
          <TextField
            ref={nextRef}
            label={t('profile_new_password_label')}
            icon="lock"
            value={next}
            onChangeText={(v) => {
              setNext(v)
              setError(null)
            }}
            // As on sign-up: the checklist while focused, the one-line error on blur if still weak.
            onFocus={() => {
              setNextFocused(true)
              if (error === t('onb_passwordWeak')) setError(null)
            }}
            onBlur={() => {
              setNextFocused(false)
              if (next && !isStrongPassword(next)) setError(t('onb_passwordWeak'))
            }}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <PasswordRequirements password={next} visible={nextFocused} />
          {error && <Notice message={error} />}
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button label={t('profile_cancel_btn')} onPress={toggle} disabled={busy} variant="secondary" />
            </View>
            <View style={styles.action}>
              <Button
                label={busy ? t('profile_change_password_busy') : t('profile_change_password_btn')}
                onPress={submit}
                busy={busy}
                disabled={!current || !next}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    ...webOnly({ cursor: 'pointer' }),
  },
  headerPressed: { opacity: 0.7 },
  title: { fontSize: 16, fontWeight: '600', color: colors.heading },
  form: { paddingTop: 4, paddingBottom: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
})
