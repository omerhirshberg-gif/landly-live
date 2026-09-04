'use client'

import Link from 'next/link'
import AuthMarketingPanel from '@/components/auth/AuthMarketingPanel'
import { useLang } from '@/lib/i18n/useLang'

// Purely static confirmation — no oobCode reading, no Firebase Auth calls.
// This is what actionCodeSettings.url in forgot-password's sendPasswordResetEmail
// points to: Firebase's hosted __/auth/action widget (still in use while the
// Console Action URL setting is unresolved) consumes the oobCode itself and
// redirects here as `continueUrl` after the user sets their new password, so
// this page must not try to re-validate an already-used code. Once the Console
// Action URL setting is fixed and links go directly to /reset-password instead
// of Firebase's widget, that page's own success state (oobCode validated firsthand)
// handles it — this page stays as the landing spot for the Firebase-widget path.
export default function ResetPasswordSuccessPage() {
  const { t, isRtl } = useLang()

  return (
    // dir="ltr" pins physical side order (form left, marketing right) regardless
    // of the active language — flex-row is otherwise direction-relative and would
    // flip under document dir="rtl". RTL styling is applied per-side below instead.
    <div className="min-h-screen flex flex-col lg:flex-row" dir="ltr">
      <div dir={isRtl ? 'rtl' : 'ltr'} className="flex-1 flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16 lg:py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="flex justify-center mb-8">
            <img src="/logo.jpg" alt="Landly" className="h-28 w-auto" />
          </Link>

          <h1 className="text-2xl font-black text-slate-900 mb-1">{t('resetSuccess_title')}</h1>
          <p className="text-sm text-slate-500 mb-7">{t('resetSuccess_message')}</p>

          <Link href="/login" className="btn-primary inline-flex">{t('resetSuccess_backToLogin')}</Link>
        </div>
      </div>

      <AuthMarketingPanel headline={t('forgot_marketing_headline')} sub={t('forgot_marketing_sub')} />
    </div>
  )
}
