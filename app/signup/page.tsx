'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import AuthCard from '@/components/auth/AuthCard'
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
    haveAccount: 'Already have an account?',
    loginLink: 'Sign in',
    toggleLabel: 'עברית',
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
    haveAccount: 'כבר יש לך חשבון?',
    loginLink: 'התחברות',
    toggleLabel: 'English',
  },
}

declare global {
  interface Window {
    intlTelInput?: (input: HTMLInputElement, options: Record<string, unknown>) => { destroy: () => void }
  }
}

// Kept as a variable (not a string literal directly in import()) so TypeScript
// treats the dynamic import as Promise<any> instead of trying to resolve this
// CDN URL as a real module.
const ITI_UTILS_URL = 'https://cdn.jsdelivr.net/npm/intl-tel-input@25.2.1/build/js/utils.js'

export default function SignupPage() {
  const { t, toggleLang } = useSimpleLang(dict)
  const phoneRef = useRef<HTMLInputElement>(null)
  const [itiReady, setItiReady] = useState(false)

  useEffect(() => {
    if (!itiReady || !phoneRef.current || !window.intlTelInput) return
    const iti = window.intlTelInput(phoneRef.current, {
      initialCountry: 'il',
      separateDialCode: true,
      loadUtils: () => import(ITI_UTILS_URL),
    })
    return () => iti.destroy()
  }, [itiReady])

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

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('fullNameLabel')}</label>
            <input type="text" required className="inp" autoComplete="name" />
          </div>

          <div>
            <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('emailLabel')}</label>
            <input type="email" required className="inp" autoComplete="email" />
          </div>

          <div>
            <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('passwordLabel')}</label>
            <input type="password" required minLength={6} className="inp" autoComplete="new-password" />
          </div>

          <div>
            <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('phoneLabel')}</label>
            <input type="tel" required ref={phoneRef} />
            <p className="text-xs text-slate-500 mt-1.5">{t('phoneNote')}</p>
          </div>

          <button type="submit" className="btn-primary mt-2">{t('submitBtn')}</button>
        </form>

        <div className="text-center mt-6 text-sm">
          <span className="text-slate-500">{t('haveAccount')}</span>{' '}
          <Link href="/login" className="text-brand font-bold hover:underline">{t('loginLink')}</Link>
        </div>
      </AuthCard>
    </>
  )
}
