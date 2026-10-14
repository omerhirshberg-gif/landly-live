'use client'

import { useState } from 'react'
import { requestVerificationEmail, type VerificationSendResult } from '@/lib/auth/requestVerificationEmail'
import { useLang } from '@/lib/i18n/useLang'
import type { TranslationKey } from '@/lib/i18n/translations'
import Button from './entrance/Button'
import Notice from './entrance/Notice'

const RESULT_MESSAGES: Record<VerificationSendResult, TranslationKey> = {
  sent: 'verifyNotice_resent',
  rateLimited: 'verifyNotice_rateLimited',
  unauthorized: 'verifyNotice_sessionExpired',
  failed: 'verifyNotice_sendFailed',
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
  initialResult,
  onBack,
}: {
  variant: 'signup' | 'login'
  email: string
  idToken: string
  initialResult?: VerificationSendResult
  onBack: () => void
}) {
  const { t, lang } = useLang()
  // After signup the first send already happened, so its success is implied
  // by the "check your inbox" copy -- only surface it if it went wrong.
  const [result, setResult] = useState<VerificationSendResult | null>(
    initialResult && initialResult !== 'sent' ? initialResult : null
  )
  const [sending, setSending] = useState(false)

  const handleResend = async () => {
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

      {result && <Notice tone={result === 'sent' ? 'success' : 'error'}>{t(RESULT_MESSAGES[result])}</Notice>}

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
