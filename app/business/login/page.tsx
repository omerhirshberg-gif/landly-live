'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import AuthMarketingPanel from '@/components/auth/AuthMarketingPanel'
import { auth } from '@/lib/firebase/config'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { getBusinessDocument } from '@/lib/firebase/businesses'
import { useLang } from '@/lib/i18n/useLang'

export default function BusinessLoginPage() {
  const { t, isRtl } = useLang()
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
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const business = await getBusinessDocument(cred.user.uid)
      if (!business) {
        await signOut(auth)
        setError(t('bizlogin_notBusinessError'))
        setSubmitting(false)
        return
      }
      router.push('/business/dashboard')
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    // dir="ltr" pins physical side order (form left, marketing right) regardless
    // of the active language — see app/login/page.tsx for the same pattern.
    // Business pages use a fixed dark theme (independent of the site's light
    // customer-facing pages) to visually set the portal apart.
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-950" dir="ltr">
      {/* Form side */}
      <div dir={isRtl ? 'rtl' : 'ltr'} className="flex-1 flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16 lg:py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
            <img src="/logo-mark.png" alt="Landly" className="h-11 w-auto" />
            <span className="font-black text-white text-2xl">Landly</span>
          </Link>

          <h1 className="text-2xl font-black text-white mb-1">{t('bizlogin_title')}</h1>
          <p className="text-sm text-slate-400 mb-7">{t('bizlogin_subtitle')}</p>

          {error && (
            <div className="mb-4 text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-300">{t('login_emailLabel')}</label>
              <input type="email" required className="inp inp-dark" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-300">{t('login_passwordLabel')}</label>
              <input type="password" required className="inp inp-dark" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-brand focus:ring-brand"
                />
                {t('login_rememberMe')}
              </label>
              <Link href="/forgot-password" className="text-sm text-blue-400 font-bold hover:underline">{t('login_forgotLink')}</Link>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary mt-2 w-full disabled:opacity-70">
              {submitting ? t('login_submitBtnBusy') : t('login_submitBtn')}
            </button>
          </form>
        </div>
      </div>

      <AuthMarketingPanel headline={t('bizlogin_marketing_headline')} sub={t('bizlogin_marketing_sub')} />
    </div>
  )
}
