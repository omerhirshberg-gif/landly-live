import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { EmailAuthProvider, reauthenticateWithCredential, type User } from 'firebase/auth'
import { CONTACT_CHANGE_FAILED, contactChangeErrorKey, requestEmailChange } from '@shared/account/contactChange'
import { getAuthErrorMessage } from '@shared/firebase/authErrors'
import AppText from './AppText'
import Button from './Button'
import Notice from './Notice'
import TextField from './TextField'
import { useLang } from '../i18n/LangProvider'
import { API_BASE_URL } from '../lib/env'
import { colors, radius } from '../theme'

// The email row's "Change" panel in the Profile tab (email+password members
// only; web: components/profile/ChangeEmailForm.tsx). The current password
// is checked first (re-authentication, as ChangePassword does), then
// /api/account/change-email emails a 6-digit code to the new address and
// onSent opens the code sheet (OtpSheet); the account keeps its current
// email until the code is entered, and the amber notice takes over meanwhile.
export default function ChangeEmailForm({
  user,
  pendingEmail,
  onSent,
  onCancel,
}: {
  user: User
  /** The address already waiting for its code, if any. */
  pendingEmail: string
  onSent: (email: string, resendIn: number) => void
  onCancel: () => void
}) {
  const { t, lang } = useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const newEmail = email.trim()
    if (!newEmail || !password || busy) return
    setBusy(true)
    setError(null)
    try {
      if (!user.email) throw new Error('no-email')
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setBusy(false)
      return
    }
    const result = await user
      .getIdToken()
      .then((idToken) => requestEmailChange(idToken, { newEmail, lang }, API_BASE_URL))
      .catch(() => CONTACT_CHANGE_FAILED)
    setBusy(false)
    if (result.ok) {
      setPassword('')
      onSent(result.pendingEmail, result.resendIn)
    } else if (result.reason === 'rateLimited' && result.retryAfter && newEmail.toLowerCase() === pendingEmail) {
      // A code for this very address went out moments ago: enter that one.
      setPassword('')
      onSent(pendingEmail, result.retryAfter)
    } else {
      setError(t(contactChangeErrorKey(result.reason)))
    }
  }

  return (
    <View style={styles.panel}>
      <AppText accessibilityRole="header" style={styles.title}>{t('profile_change_email_title')}</AppText>
      <AppText style={styles.hint}>{t('profile_change_email_hint')}</AppText>
      {error && <Notice message={error} />}
      <TextField
        label={t('profile_new_email_label')}
        icon="mail"
        value={email}
        onChangeText={(value) => {
          setEmail(value)
          setError(null)
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        autoFocus
      />
      <TextField
        label={t('profile_current_password_label')}
        icon="lock"
        value={password}
        onChangeText={(value) => {
          setPassword(value)
          setError(null)
        }}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button label={t('profile_cancel_btn')} onPress={onCancel} disabled={busy} variant="secondary" />
        </View>
        <View style={styles.action}>
          <Button label={t('profile_change_email_submit')} onPress={submit} busy={busy} disabled={!email.trim() || !password} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.heading },
  hint: { marginTop: 4, marginBottom: 14, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  // Two buttons share the row; a long label (Russian, French) wraps inside its own half.
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
})
