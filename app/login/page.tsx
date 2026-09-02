'use client'

import Link from 'next/link'
import AuthCard from '@/components/auth/AuthCard'
import { useSimpleLang } from '@/lib/i18n/useSimpleLang'

const dict = {
  en: {
    pageTitle: 'Sign In — Landly',
    title: 'Sign In',
    subtitle: 'Welcome back',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    submitBtn: 'Sign In',
    forgotLink: 'Forgot password',
    signupLink: "Don't have an account",
    toggleLabel: 'עברית',
  },
  he: {
    pageTitle: 'התחברות — Landly',
    title: 'התחברות',
    subtitle: 'נעים לראות אותך שוב',
    emailLabel: 'מייל',
    passwordLabel: 'סיסמא',
    submitBtn: 'התחברות',
    forgotLink: 'שכחתי סיסמא',
    signupLink: 'עדיין אין לי חשבון',
    toggleLabel: 'English',
  },
}

export default function LoginPage() {
  const { t, toggleLang } = useSimpleLang(dict)

  return (
    <AuthCard toggleLabel={t('toggleLabel')} onToggleLang={toggleLang}>
      <h1 className="text-2xl font-black text-slate-900 mb-1">{t('title')}</h1>
      <p className="text-sm text-slate-500 mb-7">{t('subtitle')}</p>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('emailLabel')}</label>
          <input type="email" required className="inp" autoComplete="email" />
        </div>

        <div>
          <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('passwordLabel')}</label>
          <input type="password" required className="inp" autoComplete="current-password" />
        </div>

        <button type="submit" className="btn-primary mt-2">{t('submitBtn')}</button>
      </form>

      <div className="flex items-center justify-between mt-6 text-sm">
        <Link href="/forgot-password" className="text-brand font-bold hover:underline">{t('forgotLink')}</Link>
        <Link href="/signup" className="text-brand font-bold hover:underline">{t('signupLink')}</Link>
      </div>
    </AuthCard>
  )
}
