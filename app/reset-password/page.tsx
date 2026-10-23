'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FirebaseError } from 'firebase/app'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import BackToHomeLink from '@/components/auth/BackToHomeLink'
import AuthBrandPanel from '@/components/auth/entrance/AuthBrandPanel'
import BrandHero from '@/components/auth/entrance/BrandHero'
import Button from '@/components/auth/entrance/Button'
import Notice from '@/components/auth/entrance/Notice'
import TextField from '@/components/auth/entrance/TextField'
import { ENTRANCE_VARS } from '@/components/auth/entrance/entranceVars'
import styles from '@/components/auth/entrance/entrance.module.css'
import PasswordRequirements from '@/components/auth/onboarding/PasswordRequirements'
import { ONBOARDING_VARS } from '@/components/auth/onboarding/onboardingVars'
import { reportPasswordReset } from '@/lib/account/sessionSync'
import { isStrongPassword } from '@/lib/auth/passwordValidation'
import { auth } from '@/lib/firebase/config'
import { useLang } from '@/lib/i18n/useLang'

// Landing page for the link in our branded reset email. The link is built by
// /api/auth/forgot-password from the oobCode of Firebase's own link, so the
// code is checked and applied here and users never see Firebase's hosted
// __/auth/action widget.
//
// checking → ready | invalid; ready → submitting → /reset-password/success.
// verifyPasswordResetCode doesn't use up the code and returns the account's
// email, shown read-only so the member knows which account they're resetting.
// A code that expires or gets used between the check and the submit lands on
// the invalid card too.
//
// Same shell as /verify-email and AuthScreen (/login, /signup): the brand
// panel beside the card from 1024px, the hero above it below that, in the
// site language and direction.
type Status = 'checking' | 'ready' | 'invalid' | 'submitting'
type FieldError = 'onb_passwordWeak' | 'onb_passwordMismatch'

const DEAD_CODE = new Set(['auth/expired-action-code', 'auth/invalid-action-code', 'auth/user-disabled', 'auth/user-not-found'])

function ResetPasswordContent() {
  const { t, lang, isRtl } = useLang()
  const router = useRouter()
  const oobCode = useSearchParams().get('oobCode')
  const [status, setStatus] = useState<Status>(oobCode ? 'checking' : 'invalid')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldError, setFieldError] = useState<FieldError | null>(null)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!oobCode) return
    let cancelled = false
    verifyPasswordResetCode(auth, oobCode)
      .then((accountEmail) => {
        if (cancelled) return
        setEmail(accountEmail)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('invalid')
      })
    return () => {
      cancelled = true
    }
  }, [oobCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!oobCode || status !== 'ready') return
    // Same rule as sign-up (lib/auth/passwordValidation.ts).
    if (!isStrongPassword(password)) return setFieldError('onb_passwordWeak')
    if (password !== confirm) return setFieldError('onb_passwordMismatch')
    setFieldError(null)
    setError(null)
    setStatus('submitting')
    try {
      await confirmPasswordReset(auth, oobCode, password)
      // The reset ended every session; Firestore hears of it too, so a
      // stolen one can't keep reading the member's passes.
      await reportPasswordReset(email)
      router.replace('/reset-password/success')
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : ''
      if (DEAD_CODE.has(code)) return setStatus('invalid')
      if (code === 'auth/weak-password') setFieldError('onb_passwordWeak')
      else setError(t('forgot_error_generic'))
      setStatus('ready')
    }
  }

  const submitting = status === 'submitting'

  return (
    <div
      className={`${styles.root} ${styles.standalone}`}
      data-entrance="settled"
      style={{ ...ENTRANCE_VARS, ...ONBOARDING_VARS }}
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <AuthBrandPanel context="reset" entrance="settled" />

      <main className={styles.main}>
        <div className={`${styles.chrome} ${styles.backSlot}`}>
          <BackToHomeLink label={t('auth_backHome')} />
        </div>

        <div className={styles.heroSlot}>
          <BrandHero mode="settled" />
        </div>

        {status === 'checking' ? (
          <div className={`${styles.card} text-center`} aria-live="polite">
            <div className={styles.badgeWrap} aria-hidden="true">
              <span className="flex h-full w-full items-center justify-center">
                <span className="h-10 w-10 rounded-full border-[3px] border-brand border-r-transparent animate-spin" />
              </span>
            </div>
            <p className="mb-2 text-[15px] font-semibold text-slate-500">{t('resetPage_checking')}</p>
          </div>
        ) : status === 'invalid' ? (
          <div className={`${styles.card} text-center`} aria-live="polite">
            <div className={styles.badgeWrap} aria-hidden="true">
              <span className={`${styles.badge} ${styles.badgeAlert}`}>
                <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 7v6M12 17h.01" />
                </svg>
              </span>
            </div>
            <h1 className="text-[24px] leading-8 font-extrabold text-slate-900">{t('resetPage_invalidTitle')}</h1>
            <div className="mt-4 mb-3 text-start">
              <Notice>{t('resetPage_invalidMessage')}</Notice>
            </div>
            <Button label={t('resetPage_requestNew')} onClick={() => router.push('/forgot-password')} large arrow />
            <div className="mt-6 text-sm">
              <Link href="/login" className="py-3 -my-3 font-bold text-brand hover:underline">
                {t('forgot_backLink')}
              </Link>
            </div>
          </div>
        ) : (
          <div className={styles.card}>
            <h1 className="text-[24px] leading-8 font-extrabold text-slate-900">{t('resetPage_title')}</h1>
            <p className={`${styles.subtitle} mt-2 mb-5 text-[15px] leading-6 text-slate-500`}>{t('resetPage_subtitle')}</p>

            <div className="mb-5 flex items-center gap-3 rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-[13px] font-semibold text-slate-500">{t('resetPage_accountLabel')}</span>
              <span dir="ltr" className="min-w-0 flex-1 truncate text-end text-[15px] font-semibold text-slate-900 rtl:text-start">
                {email}
              </span>
            </div>

            {error && <Notice>{error}</Notice>}

            <form noValidate onSubmit={handleSubmit}>
              {/* Lets password managers file the new password under the right account. */}
              <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
              <TextField
                label={t('resetPage_passwordLabel')}
                icon="lock"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setFieldError(null)
                }}
                // Checklist while focused; the one-line error on blur if still weak.
                onFocus={() => {
                  setPasswordFocused(true)
                  if (fieldError === 'onb_passwordWeak') setFieldError(null)
                }}
                onBlur={() => {
                  setPasswordFocused(false)
                  if (password && !isStrongPassword(password) && !fieldError) setFieldError('onb_passwordWeak')
                }}
                error={fieldError === 'onb_passwordWeak' ? t(fieldError) : undefined}
                autoComplete="new-password"
                enterKeyHint="next"
              />
              <PasswordRequirements password={password} visible={passwordFocused} />
              <TextField
                label={t('onb_confirmPasswordLabel')}
                icon="lock"
                type="password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value)
                  setFieldError(null)
                }}
                error={fieldError === 'onb_passwordMismatch' ? t(fieldError) : undefined}
                autoComplete="new-password"
                enterKeyHint="go"
              />
              <div className="mt-1">
                <Button
                  type="submit"
                  label={t(submitting ? 'resetPage_submitBtnBusy' : 'resetPage_submitBtn')}
                  busy={submitting}
                  large
                />
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  )
}
