'use client'

import { useState } from 'react'
import Link from 'next/link'
import { sendPasswordResetEmail } from 'firebase/auth'
import AuthCard from '@/components/auth/AuthCard'
import { auth } from '@/lib/firebase/config'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { useSimpleLang } from '@/lib/i18n/useSimpleLang'

const dict = {
  en: {
    pageTitle: 'Forgot Password — Landly',
    title: 'Forgot Password',
    subtitle: "We'll email you a reset link",
    emailLabel: 'Email',
    submitBtn: 'Send reset link',
    submitBtnBusy: 'Sending…',
    backLink: 'Back to sign in',
    toggleLabel: 'עברית',
    sentTitle: 'Check your email',
    sentSubtitle: "We've sent a password reset link to your email address.",
  },
  he: {
    pageTitle: 'שכחתי סיסמא — Landly',
    title: 'שכחתי סיסמא',
    subtitle: 'נשלח לך מייל עם קישור לאיפוס',
    emailLabel: 'מייל',
    submitBtn: 'שלח קישור לאיפוס',
    submitBtnBusy: 'שולח…',
    backLink: 'חזרה להתחברות',
    toggleLabel: 'English',
    sentTitle: 'בדוק/י את המייל שלך',
    sentSubtitle: 'שלחנו קישור לאיפוס סיסמא לכתובת המייל שלך.',
  },
}

export default function ForgotPasswordPage() {
  const { t, toggleLang } = useSimpleLang(dict)
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
        url: `${window.location.origin}/reset-password`,
      })
      setSent(true)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard toggleLabel={t('toggleLabel')} onToggleLang={toggleLang}>
      {sent ? (
        <>
          <h1 className="text-2xl font-black text-slate-900 mb-1">{t('sentTitle')}</h1>
          <p className="text-sm text-slate-500 mb-7">{t('sentSubtitle')}</p>
          <Link href="/login" className="text-brand font-bold hover:underline text-sm">{t('backLink')}</Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-black text-slate-900 mb-1">{t('title')}</h1>
          <p className="text-sm text-slate-500 mb-7">{t('subtitle')}</p>

          {error && (
            <div className="mb-4 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('emailLabel')}</label>
              <input type="email" required className="inp" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <button type="submit" disabled={submitting} className="btn-primary mt-2 w-full disabled:opacity-70">
              {submitting ? t('submitBtnBusy') : t('submitBtn')}
            </button>
          </form>

          <div className="text-center mt-6 text-sm">
            <Link href="/login" className="text-brand font-bold hover:underline">{t('backLink')}</Link>
          </div>
        </>
      )}
    </AuthCard>
  )
}
