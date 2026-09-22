'use client'

import { useState } from 'react'
import { requestVerificationEmail, type VerificationSendResult } from '@/lib/auth/requestVerificationEmail'
import { useLang } from '@/lib/i18n/useLang'
import type { TranslationKey } from '@/lib/i18n/translations'

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
      <h1 className="text-2xl font-black text-slate-900 mb-1">
        {t(variant === 'signup' ? 'verifyNotice_signupTitle' : 'verifyNotice_loginTitle')}
      </h1>
      <p className="text-sm text-slate-500 mb-2">
        {t(variant === 'signup' ? 'verifyNotice_signupMessage' : 'verifyNotice_loginMessage')}
      </p>
      <p className="text-sm font-bold text-slate-700 mb-7" dir="ltr">{email}</p>

      {result && (
        <div
          className={`mb-4 text-sm font-semibold rounded-xl px-4 py-3 border ${
            result === 'sent' ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'
          }`}
        >
          {t(RESULT_MESSAGES[result])}
        </div>
      )}

      <button type="button" onClick={handleResend} disabled={sending} className="btn-primary w-full disabled:opacity-70">
        {sending ? t('verifyNotice_resendBusy') : t('verifyNotice_resendBtn')}
      </button>

      <div className="text-center mt-6 text-sm">
        <button type="button" onClick={onBack} className="text-brand font-bold hover:underline">
          {t('verifyNotice_backToLogin')}
        </button>
      </div>
    </div>
  )
}
