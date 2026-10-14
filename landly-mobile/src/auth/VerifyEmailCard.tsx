import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { requestVerificationEmail, type VerificationSendResult } from '@shared/auth/requestVerificationEmail'
import type { TranslationKey } from '@shared/i18n/translations'
import AppText from '../components/AppText'
import Button from '../components/Button'
import Notice from '../components/Notice'
import { useLang } from '../i18n/LangProvider'
import { API_BASE_URL } from '../lib/env'
import { colors } from '../theme'

const RESULT_MESSAGES: Record<VerificationSendResult, TranslationKey> = {
  sent: 'verifyNotice_sent',
  rateLimited: 'verifyNotice_rateLimited',
  unauthorized: 'verifyNotice_sessionExpired',
  failed: 'verifyNotice_sendFailed',
  offline: 'verifyNotice_offline',
  // Logged to the console with the redirect; to the user it's a failed send.
  misconfigured: 'verifyNotice_sendFailed',
}

export interface PendingVerification {
  variant: 'signup' | 'login'
  email: string
  idToken: string
  /** The first send, still in flight (signup sends one up front without waiting for it). */
  initialSend?: Promise<VerificationSendResult>
}

// Native counterpart of components/auth/VerifyEmailNotice.tsx. The user has
// already been signed out, so `idToken` (captured just before signOut) is
// what authorizes a resend; after an hour the endpoint 401s and we ask for a
// fresh sign-in.
export default function VerifyEmailCard({ pending, onBack }: { pending: PendingVerification; onBack: () => void }) {
  const { t, lang } = useLang()
  const signup = pending.variant === 'signup'
  const { initialSend } = pending
  const [result, setResult] = useState<VerificationSendResult | null>(null)
  // Sign-up's own send is still in flight when the card appears.
  const [sending, setSending] = useState(!!initialSend)

  // Every send, the first and each resend, ends in a visible outcome: a
  // success banner, or an error with the resend button as the retry.
  useEffect(() => {
    if (!initialSend) return
    let active = true
    initialSend.then((sent) => {
      if (!active) return
      setResult(sent)
      setSending(false)
    })
    return () => {
      active = false
    }
  }, [initialSend])

  const handleResend = async () => {
    setResult(null)
    setSending(true)
    setResult(await requestVerificationEmail(pending.idToken, lang, API_BASE_URL))
    setSending(false)
  }

  return (
    <View>
      <AppText style={styles.title}>{t(signup ? 'verifyNotice_signupTitle' : 'verifyNotice_loginTitle')}</AppText>
      <AppText style={styles.subtitle}>{t(signup ? 'verifyNotice_signupMessage' : 'verifyNotice_loginMessage')}</AppText>
      <AppText ltr style={styles.email}>{pending.email}</AppText>
      {sending ? (
        <Notice message={t('verifyNotice_sending')} tone="info" />
      ) : (
        result && <Notice message={t(RESULT_MESSAGES[result])} tone={result === 'sent' ? 'success' : 'error'} />
      )}
      <Button
        label={sending ? t('verifyNotice_resendBusy') : t('verifyNotice_resendBtn')}
        onPress={handleResend}
        busy={sending}
        large
      />
      <View style={styles.gap} />
      <Button label={t('verifyNotice_backToLogin')} onPress={onBack} variant="secondary" large />
    </View>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, color: colors.textStrong, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.textMuted, marginBottom: 24, textAlign: 'center' },
  email: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: -8, marginBottom: 24, textAlign: 'center' },
  gap: { height: 12 },
})
