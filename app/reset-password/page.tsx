'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import AuthCard from '@/components/auth/AuthCard'
import { auth } from '@/lib/firebase/config'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { useSimpleLang } from '@/lib/i18n/useSimpleLang'

const dict = {
  en: {
    pageTitle: 'Reset Password — Landly',
    title: 'Set New Password',
    subtitle: 'Choose a new password for your account',
    passwordLabel: 'New password',
    confirmLabel: 'Confirm password',
    submitBtn: 'Update password',
    submitBtnBusy: 'Updating…',
    mismatch: 'Passwords do not match.',
    invalidLink: 'This reset link is invalid or has expired.',
    requestNew: 'Request a new link',
    doneTitle: 'Password updated',
    doneSubtitle: 'You can now sign in with your new password.',
    signInLink: 'Sign in',
  },
  he: {
    pageTitle: 'איפוס סיסמא — Landly',
    title: 'קביעת סיסמא חדשה',
    subtitle: 'בחר/י סיסמא חדשה לחשבון שלך',
    passwordLabel: 'סיסמא חדשה',
    confirmLabel: 'אימות סיסמא',
    submitBtn: 'עדכן סיסמא',
    submitBtnBusy: 'מעדכן…',
    mismatch: 'הסיסמאות אינן תואמות.',
    invalidLink: 'קישור האיפוס אינו תקין או שפג תוקפו.',
    requestNew: 'בקש קישור חדש',
    doneTitle: 'הסיסמא עודכנה',
    doneSubtitle: 'כעת ניתן להתחבר עם הסיסמא החדשה.',
    signInLink: 'התחברות',
  },
}

function ResetPasswordForm() {
  const { t } = useSimpleLang(dict)
  const searchParams = useSearchParams()
  const oobCode = searchParams.get('oobCode')

  const [checking, setChecking] = useState(true)
  const [validCode, setValidCode] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!oobCode) {
      setChecking(false)
      return
    }
    verifyPasswordResetCode(auth, oobCode)
      .then(() => setValidCode(true))
      .catch(() => setValidCode(false))
      .finally(() => setChecking(false))
  }, [oobCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!oobCode) return
    if (password !== confirmPassword) {
      setError(t('mismatch'))
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await confirmPasswordReset(auth, oobCode, password)
      setDone(true)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <AuthCard>
        <div className="h-24" />
      </AuthCard>
    )
  }

  if (done) {
    return (
      <AuthCard>
        <h1 className="text-2xl font-black text-slate-900 mb-1">{t('doneTitle')}</h1>
        <p className="text-sm text-slate-500 mb-7">{t('doneSubtitle')}</p>
        <Link href="/login" className="btn-primary inline-flex">{t('signInLink')}</Link>
      </AuthCard>
    )
  }

  if (!oobCode || !validCode) {
    return (
      <AuthCard>
        <h1 className="text-2xl font-black text-slate-900 mb-1">{t('title')}</h1>
        <div className="mb-4 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {t('invalidLink')}
        </div>
        <Link href="/forgot-password" className="text-brand font-bold hover:underline text-sm">{t('requestNew')}</Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <h1 className="text-2xl font-black text-slate-900 mb-1">{t('title')}</h1>
      <p className="text-sm text-slate-500 mb-7">{t('subtitle')}</p>

      {error && (
        <div className="mb-4 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('passwordLabel')}</label>
          <input type="password" required minLength={6} className="inp" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div>
          <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('confirmLabel')}</label>
          <input type="password" required minLength={6} className="inp" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary mt-2 w-full disabled:opacity-70">
          {submitting ? t('submitBtnBusy') : t('submitBtn')}
        </button>
      </form>
    </AuthCard>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}
