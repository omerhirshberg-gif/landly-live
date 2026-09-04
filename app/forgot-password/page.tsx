'use client'

import { useState } from 'react'
import Link from 'next/link'
import { sendPasswordResetEmail } from 'firebase/auth'
import AuthMarketingPanel from '@/components/auth/AuthMarketingPanel'
import { auth } from '@/lib/firebase/config'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { useLang } from '@/lib/i18n/useLang'

export default function ForgotPasswordPage() {
  const { t, isRtl } = useLang()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await sendPasswordResetEmail(auth, email, {
        // Points at the static success page, not /reset-password: while Firebase's
        // hosted __/auth/action widget is still handling the reset (Console Action
        // URL setting unresolved), it consumes the oobCode itself and redirects here
        // as continueUrl — /reset-password would then try to re-validate an
        // already-used code and show a false "invalid or expired" error.
        url: `${window.location.origin}/reset-password/success`,
        handleCodeInApp: true,
      })
      setSent(true)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    // dir="ltr" pins physical side order (form left, marketing right) regardless
    // of the active language — flex-row is otherwise direction-relative and would
    // flip under document dir="rtl". RTL styling is applied per-side below instead.
    <div className="min-h-screen flex flex-col lg:flex-row" dir="ltr">
      {/* Form side */}
      <div dir={isRtl ? 'rtl' : 'ltr'} className="flex-1 flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16 lg:py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="flex justify-center mb-8">
            <img src="/logo.jpg" alt="Landly" className="h-28 w-auto" />
          </Link>

          {sent ? (
            <>
              <h1 className="text-2xl font-black text-slate-900 mb-1">{t('forgot_sentTitle')}</h1>
              <p className="text-sm text-slate-500 mb-7">{t('forgot_sentSubtitle')}</p>
              <Link href="/login" className="text-brand font-bold hover:underline text-sm">{t('forgot_backLink')}</Link>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-black text-slate-900 mb-1">{t('forgot_title')}</h1>
              <p className="text-sm text-slate-500 mb-7">{t('forgot_subtitle')}</p>

              {error && (
                <div className="mb-4 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('forgot_emailLabel')}</label>
                  <input type="email" required className="inp" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                <button type="submit" disabled={submitting} className="btn-primary mt-2 w-full disabled:opacity-70">
                  {submitting ? t('forgot_submitBtnBusy') : t('forgot_submitBtn')}
                </button>
              </form>

              <p className="text-xs text-slate-500 mt-4 leading-relaxed">{t('forgot_privacyNote')}</p>

              <div className="text-center mt-6 text-sm">
                <Link href="/login" className="text-brand font-bold hover:underline">{t('forgot_backLink')}</Link>
              </div>
            </>
          )}
        </div>
      </div>

      <AuthMarketingPanel headline={t('forgot_marketing_headline')} sub={t('forgot_marketing_sub')} />
    </div>
  )
}
