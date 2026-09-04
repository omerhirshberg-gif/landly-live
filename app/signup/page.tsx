'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth'
import AuthMarketingPanel from '@/components/auth/AuthMarketingPanel'
import GoogleButton from '@/components/auth/GoogleButton'
import { auth, googleProvider } from '@/lib/firebase/config'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { createUserDocument, ensureUserDocument } from '@/lib/firebase/users'
import { useLang } from '@/lib/i18n/useLang'
import type { TranslationKey } from '@/lib/i18n/translations'

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

const CUSTOMER_TYPES: { value: string; labelKey: TranslationKey }[] = [
  { value: 'student', labelKey: 'signup_customerType_student' },
  { value: 'new_immigrant', labelKey: 'signup_customerType_newImmigrant' },
  { value: 'long_term_program', labelKey: 'signup_customerType_longTermProgram' },
  { value: 'taglit', labelKey: 'signup_customerType_taglit' },
  { value: 'traveler', labelKey: 'signup_customerType_traveler' },
  { value: 'other', labelKey: 'signup_customerType_other' },
]

export default function SignupPage() {
  const { t, isRtl } = useLang()
  const router = useRouter()
  const phoneRef = useRef<HTMLInputElement>(null)
  const itiRef = useRef<{ destroy: () => void; getNumber: () => string } | null>(null)
  const [itiReady, setItiReady] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [customerType, setCustomerType] = useState('')
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
      await createUserDocument(cred.user, { phone, customerType })
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

      {/* dir="ltr" pins physical side order (form left, marketing right) regardless
          of the active language — flex-row is otherwise direction-relative and would
          flip under document dir="rtl". RTL styling is applied per-side below instead. */}
      <div className="min-h-screen flex flex-col lg:flex-row" dir="ltr">
        {/* Form side */}
        <div dir={isRtl ? 'rtl' : 'ltr'} className="flex-1 flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16 lg:py-12">
          <div className="w-full max-w-md">
            <Link href="/" className="flex justify-center mb-8">
              <img src="/logo.jpg" alt="Landly" className="h-28 w-auto" />
            </Link>

            <h1 className="text-2xl font-black text-slate-900 mb-1">{t('signup_title')}</h1>
            <p className="text-sm text-slate-500 mb-7">{t('signup_subtitle')}</p>

            {error && (
              <div className="mb-4 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('signup_fullNameLabel')}</label>
                <input type="text" required className="inp" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('signup_emailLabel')}</label>
                <input type="email" required className="inp" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('signup_passwordLabel')}</label>
                <input type="password" required minLength={6} className="inp" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>

              <div>
                <label className="flex items-center gap-1.5 mb-1.5 text-sm font-bold text-slate-700">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  {t('signup_customerTypeLabel')}
                </label>
                <select required className="inp" value={customerType} onChange={(e) => setCustomerType(e.target.value)}>
                  <option value="" disabled>{t('signup_customerType_placeholder')}</option>
                  {CUSTOMER_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('signup_phoneLabel')}</label>
                <input type="tel" required ref={phoneRef} />
                <p className="text-xs text-slate-500 mt-1.5">{t('signup_phoneNote')}</p>
              </div>

              <button type="submit" disabled={submitting} className="btn-primary mt-2 w-full disabled:opacity-70">
                {submitting ? t('signup_submitBtnBusy') : t('signup_submitBtn')}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-semibold text-slate-400 uppercase">{t('signup_orDivider')}</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <GoogleButton label={t('signup_googleBtn')} onClick={handleGoogle} disabled={submitting} />

            <div className="text-center mt-6 text-sm">
              <span className="text-slate-500">{t('signup_haveAccount')}</span>{' '}
              <Link href="/login" className="text-brand font-bold hover:underline">{t('signup_loginLink')}</Link>
            </div>
          </div>
        </div>

        <AuthMarketingPanel headline={t('signup_marketing_headline')} sub={t('signup_marketing_sub')} />
      </div>
    </>
  )
}
