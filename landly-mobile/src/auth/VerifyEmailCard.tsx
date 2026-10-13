import { useState } from 'react'
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
  sent: 'verifyNotice_resent',
  rateLimited: 'verifyNotice_rateLimited',
  unauthorized: 'verifyNotice_sessionExpired',
  failed: 'verifyNotice_sendFailed',
}

export interface PendingVerification {
  variant: 'signup' | 'login'
  email: string
  idToken: string
  /** Result of the send that already happened (signup sends one up front). */
  initialResult?: VerificationSendResult
}

// Native counterpart of components/auth/VerifyEmailNotice.tsx. The user has
// already been signed out, so `idToken` (captured just before signOut) is
// what authorizes a resend; after an hour the endpoint 401s and we ask for a
// fresh sign-in.
export default function VerifyEmailCard({ pending, onBack }: { pending: PendingVerification; onBack: () => void }) {
  const { t, lang } = useLang()
  const signup = pending.variant === 'signup'
  // After signup the first send's success is implied by the "check your
  // inbox" copy — only surface it if it went wrong.
  const [result, setResult] = useState<VerificationSendResult | null>(
    pending.initialResult && pending.initialResult !== 'sent' ? pending.initialResult : null
  )
  const [sending, setSending] = useState(false)

  const handleResend = async () => {
    setSending(true)
    setResult(await requestVerificationEmail(pending.idToken, lang, API_BASE_URL))
    setSending(false)
  }

  return (
    <View>
      <AppText style={styles.title}>{t(signup ? 'verifyNotice_signupTitle' : 'verifyNotice_loginTitle')}</AppText>
      <AppText style={styles.subtitle}>{t(signup ? 'verifyNotice_signupMessage' : 'verifyNotice_loginMessage')}</AppText>
      <AppText ltr style={styles.email}>{pending.email}</AppText>
      {result && <Notice message={t(RESULT_MESSAGES[result])} tone={result === 'sent' ? 'success' : 'error'} />}
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
