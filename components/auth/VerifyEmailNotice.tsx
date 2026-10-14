'use client'

import { useEffect, useState } from 'react'
import { requestVerificationEmail, type VerificationSendResult } from '@/lib/auth/requestVerificationEmail'
import { useLang } from '@/lib/i18n/useLang'
import type { TranslationKey } from '@/lib/i18n/translations'
import Button from './entrance/Button'
import Notice from './entrance/Notice'

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

// Shown in place of the signup/login form once an email+password account is
// known to be unverified. The user has already been signed out by then, so
// `idToken` (captured just before signOut) is what authorizes a resend; it's
// valid for an hour, after which the endpoint 401s and we ask for a re-login.
// Same layout as the mobile app's VerifyEmailCard.
export default function VerifyEmailNotice({
  variant,
  email,
  idToken,
  initialSend,
  onBack,
}: {
  variant: 'signup' | 'login'
  email: string
  idToken: string
  initialSend?: Promise<VerificationSendResult>
  onBack: () => void
}) {
  const { t, lang } = useLang()
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
    setResult(await requestVerificationEmail(idToken, lang))
    setSending(false)
  }

  return (
    <div>
      <h1 className="mb-1.5 text-center text-[22px] font-extrabold tracking-[-0.5px] text-slate-900">
        {t(variant === 'signup' ? 'verifyNotice_signupTitle' : 'verifyNotice_loginTitle')}
      </h1>
      <p className="mb-6 text-center text-sm leading-5 text-slate-500">
        {t(variant === 'signup' ? 'verifyNotice_signupMessage' : 'verifyNotice_loginMessage')}
      </p>
      <p className="-mt-2 mb-6 text-center text-sm font-bold text-slate-700" dir="ltr">{email}</p>

      {sending ? (
        <Notice tone="info">{t('verifyNotice_sending')}</Notice>
      ) : (
        result && <Notice tone={result === 'sent' ? 'success' : 'error'}>{t(RESULT_MESSAGES[result])}</Notice>
      )}

      <Button
        label={sending ? t('verifyNotice_resendBusy') : t('verifyNotice_resendBtn')}
        onClick={handleResend}
        busy={sending}
        large
      />
      <div className="h-3" />
      <Button label={t('verifyNotice_backToLogin')} onClick={onBack} variant="secondary" large />
    </div>
  )
}
