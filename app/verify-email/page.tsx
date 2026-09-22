'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { applyActionCode } from 'firebase/auth'
import AuthMarketingPanel from '@/components/auth/AuthMarketingPanel'
import BackToHomeLink from '@/components/auth/BackToHomeLink'
import { auth } from '@/lib/firebase/config'
import { useLang } from '@/lib/i18n/useLang'

// Landing page for the link in our branded verification email. The link is
// built by /api/auth/send-verification from the oobCode of Firebase's own
// link, so the code is applied here directly and users never see Firebase's
// hosted __/auth/action widget.
function VerifyEmailContent() {
  const { t, isRtl } = useLang()
  const oobCode = useSearchParams().get('oobCode')
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(oobCode ? 'verifying' : 'error')
  // An oobCode is single-use, so a second applyActionCode (React StrictMode's
  // double effect in dev) would fail and flip a real success into an error.
  const applied = useRef(false)

  useEffect(() => {
    if (!oobCode || applied.current) return
    applied.current = true
    applyActionCode(auth, oobCode)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [oobCode])

  return (
    // dir="ltr" pins physical side order (form left, marketing right) regardless
    // of the active language — flex-row is otherwise direction-relative and would
    // flip under document dir="rtl". RTL styling is applied per-side below instead.
    <div className="min-h-screen flex flex-col lg:flex-row" dir="ltr">
      <div dir={isRtl ? 'rtl' : 'ltr'} className="flex-1 flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16 lg:py-12">
        <div className="w-full max-w-md">
          <BackToHomeLink label={t('auth_backHome')} />
          <Link href="/" className="flex justify-center mb-8">
            <img src="/logo.jpg" alt="Landly" className="h-28 w-auto" />
          </Link>

          {status === 'verifying' && <p className="text-sm text-slate-500">{t('verifyPage_verifying')}</p>}

          {status === 'success' && (
            <>
              <h1 className="text-2xl font-black text-slate-900 mb-1">{t('verifyPage_successTitle')}</h1>
              <p className="text-sm text-slate-500 mb-7">{t('verifyPage_successMessage')}</p>
              <Link href="/login" className="btn-primary inline-flex">{t('verifyPage_toLogin')}</Link>
            </>
          )}

          {status === 'error' && (
            <>
              <h1 className="text-2xl font-black text-slate-900 mb-1">{t('verifyPage_errorTitle')}</h1>
              <div className="mb-7 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {t('verifyPage_errorMessage')}
              </div>
              <Link href="/login" className="btn-primary inline-flex">{t('verifyPage_toLogin')}</Link>
            </>
          )}
        </div>
      </div>

      <AuthMarketingPanel headline={t('signup_marketing_headline')} sub={t('signup_marketing_sub')} />
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  )
}
