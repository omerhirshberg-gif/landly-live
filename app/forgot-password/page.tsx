'use client'

import Link from 'next/link'
import AuthCard from '@/components/auth/AuthCard'
import { useSimpleLang } from '@/lib/i18n/useSimpleLang'

const dict = {
  en: {
    pageTitle: 'Forgot Password — Landly',
    title: 'Forgot Password',
    subtitle: "We'll email you a reset link",
    emailLabel: 'Email',
    submitBtn: 'Send reset link',
    backLink: 'Back to sign in',
    toggleLabel: 'עברית',
  },
  he: {
    pageTitle: 'שכחתי סיסמא — Landly',
    title: 'שכחתי סיסמא',
    subtitle: 'נשלח לך מייל עם קישור לאיפוס',
    emailLabel: 'מייל',
    submitBtn: 'שלח קישור לאיפוס',
    backLink: 'חזרה להתחברות',
    toggleLabel: 'English',
  },
}

export default function ForgotPasswordPage() {
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

        <button type="submit" className="btn-primary mt-2">{t('submitBtn')}</button>
      </form>

      <div className="text-center mt-6 text-sm">
        <Link href="/login" className="text-brand font-bold hover:underline">{t('backLink')}</Link>
      </div>
    </AuthCard>
  )
}
