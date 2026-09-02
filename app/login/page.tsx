'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth'
import AuthCard from '@/components/auth/AuthCard'
import GoogleButton from '@/components/auth/GoogleButton'
import { auth, googleProvider } from '@/lib/firebase/config'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { ensureUserDocument } from '@/lib/firebase/users'
import { useSimpleLang } from '@/lib/i18n/useSimpleLang'

const dict = {
  en: {
    pageTitle: 'Sign In — Landly',
    title: 'Sign In',
    subtitle: 'Welcome back',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    submitBtn: 'Sign In',
    submitBtnBusy: 'Signing in…',
    forgotLink: 'Forgot password',
    signupLink: "Don't have an account",
    toggleLabel: 'עברית',
    orDivider: 'or',
    googleBtn: 'Continue with Google',
  },
  he: {
    pageTitle: 'התחברות — Landly',
    title: 'התחברות',
    subtitle: 'נעים לראות אותך שוב',
    emailLabel: 'מייל',
    passwordLabel: 'סיסמא',
    submitBtn: 'התחברות',
    submitBtnBusy: 'מתחבר…',
    forgotLink: 'שכחתי סיסמא',
    signupLink: 'עדיין אין לי חשבון',
    toggleLabel: 'English',
    orDivider: 'או',
    googleBtn: 'המשך עם Google',
  },
}

export default function LoginPage() {
  const { t, toggleLang } = useSimpleLang(dict)
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push('/member')
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    try {
      const cred = await signInWithPopup(auth, googleProvider)
      await ensureUserDocument(cred.user)
      router.push('/member')
    } catch (err) {
      setError(getAuthErrorMessage(err))
    }
  }

  return (
    <AuthCard toggleLabel={t('toggleLabel')} onToggleLang={toggleLang}>
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

        <div>
          <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('passwordLabel')}</label>
          <input type="password" required className="inp" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary mt-2 w-full disabled:opacity-70">
          {submitting ? t('submitBtnBusy') : t('submitBtn')}
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-semibold text-slate-400 uppercase">{t('orDivider')}</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <GoogleButton label={t('googleBtn')} onClick={handleGoogle} disabled={submitting} />

      <div className="flex items-center justify-between mt-6 text-sm">
        <Link href="/forgot-password" className="text-brand font-bold hover:underline">{t('forgotLink')}</Link>
        <Link href="/signup" className="text-brand font-bold hover:underline">{t('signupLink')}</Link>
      </div>
    </AuthCard>
  )
}
