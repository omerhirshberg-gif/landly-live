'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import AuthMarketingPanel from '@/components/auth/AuthMarketingPanel'
import GoogleButton from '@/components/auth/GoogleButton'
import { auth, googleProvider } from '@/lib/firebase/config'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { ensureUserDocument } from '@/lib/firebase/users'
import { useLang } from '@/lib/i18n/useLang'

export default function LoginPage() {
  const { t } = useLang()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
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
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
      const cred = await signInWithPopup(auth, googleProvider)
      await ensureUserDocument(cred.user)
      router.push('/member')
    } catch (err) {
      setError(getAuthErrorMessage(err))
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Form side */}
      <div className="flex-1 flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16 lg:py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="flex justify-center mb-8">
            <img src="/logo.jpg" alt="Landly" className="h-28 w-auto" />
          </Link>

          <h1 className="text-2xl font-black text-slate-900 mb-1">{t('login_title')}</h1>
          <p className="text-sm text-slate-500 mb-7">{t('login_subtitle')}</p>

          {error && (
            <div className="mb-4 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('login_emailLabel')}</label>
              <input type="email" required className="inp" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('login_passwordLabel')}</label>
              <input type="password" required className="inp" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                {t('login_rememberMe')}
              </label>
              <Link href="/forgot-password" className="text-sm text-brand font-bold hover:underline">{t('login_forgotLink')}</Link>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary mt-2 w-full disabled:opacity-70">
              {submitting ? t('login_submitBtnBusy') : t('login_submitBtn')}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-semibold text-slate-400 uppercase">{t('login_orDivider')}</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <GoogleButton label={t('login_googleBtn')} onClick={handleGoogle} disabled={submitting} />

          <div className="text-center mt-6 text-sm">
            <span className="text-slate-500">{t('login_noAccount')}</span>{' '}
            <Link href="/signup" className="text-brand font-bold hover:underline">{t('login_signupLink')}</Link>
          </div>
        </div>
      </div>

      <AuthMarketingPanel headline={t('login_marketing_headline')} sub={t('login_marketing_sub')} />
    </div>
  )
}
