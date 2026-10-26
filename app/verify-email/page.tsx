'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { applyActionCode } from 'firebase/auth'
import BackToHomeLink from '@/components/auth/BackToHomeLink'
import AuthBrandPanel from '@/components/auth/entrance/AuthBrandPanel'
import BrandHero from '@/components/auth/entrance/BrandHero'
import Button from '@/components/auth/entrance/Button'
import Notice from '@/components/auth/entrance/Notice'
import { ENTRANCE_VARS } from '@/components/auth/entrance/entranceVars'
import styles from '@/components/auth/entrance/entrance.module.css'
import { ONBOARDING_VARS } from '@/components/auth/onboarding/onboardingVars'
import { ONB_ICONS } from '@/lib/brand/onboardingIcons'
import { auth } from '@/lib/firebase/config'
import { useLang } from '@/lib/i18n/useLang'

// Landing page for the link in our branded verification email. The link is
// built by /api/auth/send-verification from the oobCode of Firebase's own
// link, so the code is applied here directly and users never see Firebase's
// hosted __/auth/action widget.
//
// Same shell as AuthScreen (/login, /signup): the brand panel with the
// account journey beside the card from 1024px, the hero above it below that,
// in the site language and direction. Verified, the journey moves on to
// Personalize; signing in from here opens the onboarding wizard on /login.
// The card is centred around a status badge: a spinner while the code is
// applied, then the celebration check or a muted alert.
function VerifyEmailContent() {
  const { t, lang, isRtl } = useLang()
  const router = useRouter()
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
    <div
      className={`${styles.root} ${styles.standalone}`}
      data-entrance="settled"
      style={{ ...ENTRANCE_VARS, ...ONBOARDING_VARS }}
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <AuthBrandPanel context={status === 'success' ? 'verified' : 'verify'} entrance="settled" />

      <main className={styles.main}>
        <div className={`${styles.chrome} ${styles.backSlot}`}>
          <BackToHomeLink label={t('auth_backHome')} />
        </div>

        <div className={styles.heroSlot}>
          <BrandHero mode="settled" />
        </div>

        <div className={`${styles.card} text-center`} aria-live="polite">
          {/* One 88px slot for spinner, check or alert, so the card keeps its
              height when the result lands. The check is the onboarding
              celebration badge (spring scale-in, breathing halo; still under
              reduced motion). */}
          <div className={styles.badgeWrap} aria-hidden="true">
            {status === 'verifying' ? (
              <span className="flex h-full w-full items-center justify-center">
                <span className="h-10 w-10 rounded-full border-[3px] border-brand border-r-transparent animate-spin" />
              </span>
            ) : status === 'success' ? (
              <>
                <span className={styles.halo} />
                <span className={styles.badge}>
                  <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round">
                    <path d={ONB_ICONS.check} />
                  </svg>
                </span>
              </>
            ) : (
              <span className={`${styles.badge} ${styles.badgeAlert}`}>
                <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 7v6M12 17h.01" />
                </svg>
              </span>
            )}
          </div>

          {status === 'verifying' ? (
            <p className="mb-2 text-copy font-semibold text-slate-500">{t('verifyPage_verifying')}</p>
          ) : (
            <>
              <h1 className="text-2xl leading-8 font-extrabold text-slate-900">
                {t(status === 'success' ? 'verifyPage_successTitle' : 'verifyPage_errorTitle')}
              </h1>
              {status === 'success' ? (
                <p className="mt-2 mb-7 text-copy leading-6 text-slate-500">{t('verifyPage_successMessage')}</p>
              ) : (
                <div className="mt-4 mb-3 text-start">
                  <Notice>{t('verifyPage_errorMessage')}</Notice>
                </div>
              )}
              <Button label={t('verifyPage_toLogin')} onClick={() => router.push('/login')} large arrow />
            </>
          )}
        </div>
      </main>
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
