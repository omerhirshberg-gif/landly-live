'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth'
import AuthCard from '@/components/auth/AuthCard'
import GoogleButton from '@/components/auth/GoogleButton'
import { auth, googleProvider } from '@/lib/firebase/config'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { createUserDocument, ensureUserDocument } from '@/lib/firebase/users'
import { useSimpleLang } from '@/lib/i18n/useSimpleLang'

const dict = {
  en: {
    pageTitle: 'Sign Up — Landly',
    title: 'Sign Up',
    subtitle: 'Create your Landly account',
    fullNameLabel: 'Full name',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    phoneLabel: 'Phone number',
    phoneNote: "Enter your WhatsApp number — we'll use it for important updates",
    submitBtn: 'Sign Up',
    submitBtnBusy: 'Creating account…',
    haveAccount: 'Already have an account?',
    loginLink: 'Sign in',
    toggleLabel: 'עברית',
    orDivider: 'or',
    googleBtn: 'Continue with Google',
  },
  he: {
    pageTitle: 'הרשמה — Landly',
    title: 'הרשמה',
    subtitle: 'צור/י חשבון Landly',
    fullNameLabel: 'שם מלא',
    emailLabel: 'מייל',
    passwordLabel: 'סיסמא',
    phoneLabel: 'מספר טלפון',
    phoneNote: 'הכנס את מספר הווצאפ שלך — נשתמש בו לעדכונים חשובים',
    submitBtn: 'הרשמה',
    submitBtnBusy: 'יוצר חשבון…',
    haveAccount: 'כבר יש לך חשבון?',
    loginLink: 'התחברות',
    toggleLabel: 'English',
    orDivider: 'או',
    googleBtn: 'המשך עם Google',
  },
}

declare global {
  interface Window {
    intlTelInput?: (
      input: HTMLInputElement,
      options: Record<string, unknown>
    ) => { destroy: () => void; getNumber: () => string }
  }
}

// Kept as a variable (not a string literal directly in import()) so TypeScript
// treats the dynamic import as Promise<any> instead of trying to resolve this
// CDN URL as a real module.
const ITI_UTILS_URL = 'https://cdn.jsdelivr.net/npm/intl-tel-input@25.2.1/build/js/utils.js'

export default function SignupPage() {
  const { t, toggleLang } = useSimpleLang(dict)
  const router = useRouter()
  const phoneRef = useRef<HTMLInputElement>(null)
  const itiRef = useRef<{ destroy: () => void; getNumber: () => string } | null>(null)
  const [itiReady, setItiReady] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!itiReady || !phoneRef.current || !window.intlTelInput) return
    const iti = window.intlTelInput(phoneRef.current, {
      initialCountry: 'il',
      separateDialCode: true,
      // webpackIgnore stops Turbopack/webpack from treating this as a bundleable
      // module request (which silently fails for a non-literal CDN specifier and
      // never issues the real network fetch) - it must stay a genuine runtime import.
      loadUtils: () => import(/* webpackIgnore: true */ ITI_UTILS_URL),
    })
    itiRef.current = iti
    return () => {
      iti.destroy()
      itiRef.current = null
    }
  }, [itiReady])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      const trimmedName = fullName.trim()
      if (trimmedName) {
        await updateProfile(cred.user, { displayName: trimmedName })
      }
      const phone = itiRef.current?.getNumber() || phoneRef.current?.value || ''
      await createUserDocument(cred.user, { phone })
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
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/intl-tel-input@25.2.1/build/css/intlTelInput.css" />
      <Script
        src="https://cdn.jsdelivr.net/npm/intl-tel-input@25.2.1/build/js/intlTelInput.min.js"
        strategy="afterInteractive"
        onLoad={() => setItiReady(true)}
      />

      <AuthCard toggleLabel={t('toggleLabel')} onToggleLang={toggleLang} wrapperClassName="py-6">
        <h1 className="text-2xl font-black text-slate-900 mb-1">{t('title')}</h1>
        <p className="text-sm text-slate-500 mb-7">{t('subtitle')}</p>

        {error && (
          <div className="mb-4 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('fullNameLabel')}</label>
            <input type="text" required className="inp" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('emailLabel')}</label>
            <input type="email" required className="inp" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('passwordLabel')}</label>
            <input type="password" required minLength={6} className="inp" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <div>
            <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('phoneLabel')}</label>
            <input type="tel" required ref={phoneRef} />
            <p className="text-xs text-slate-500 mt-1.5">{t('phoneNote')}</p>
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

        <div className="text-center mt-6 text-sm">
          <span className="text-slate-500">{t('haveAccount')}</span>{' '}
          <Link href="/login" className="text-brand font-bold hover:underline">{t('loginLink')}</Link>
        </div>
      </AuthCard>
    </>
  )
}
