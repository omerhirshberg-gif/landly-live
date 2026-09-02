'use client'

import AuthCard from '@/components/auth/AuthCard'
import { useSimpleLang } from '@/lib/i18n/useSimpleLang'

const dict = {
  en: {
    pageTitle: 'Reset Password — Landly',
    title: 'Set New Password',
    subtitle: 'Choose a new password for your account',
    passwordLabel: 'New password',
    confirmLabel: 'Confirm password',
    submitBtn: 'Update password',
    toggleLabel: 'עברית',
  },
  he: {
    pageTitle: 'איפוס סיסמא — Landly',
    title: 'קביעת סיסמא חדשה',
    subtitle: 'בחר/י סיסמא חדשה לחשבון שלך',
    passwordLabel: 'סיסמא חדשה',
    confirmLabel: 'אימות סיסמא',
    submitBtn: 'עדכן סיסמא',
    toggleLabel: 'English',
  },
}

export default function ResetPasswordPage() {
  const { t, toggleLang } = useSimpleLang(dict)

  return (
    <AuthCard toggleLabel={t('toggleLabel')} onToggleLang={toggleLang}>
      <h1 className="text-2xl font-black text-slate-900 mb-1">{t('title')}</h1>
      <p className="text-sm text-slate-500 mb-7">{t('subtitle')}</p>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('passwordLabel')}</label>
          <input type="password" required minLength={6} className="inp" autoComplete="new-password" />
        </div>

        <div>
          <label className="block mb-1.5 text-sm font-bold text-slate-700">{t('confirmLabel')}</label>
          <input type="password" required minLength={6} className="inp" autoComplete="new-password" />
        </div>

        <button type="submit" className="btn-primary mt-2">{t('submitBtn')}</button>
      </form>
    </AuthCard>
  )
}
