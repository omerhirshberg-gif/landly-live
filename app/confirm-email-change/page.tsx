'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import BackToHomeLink from '@/components/auth/BackToHomeLink'
import AuthBrandPanel from '@/components/auth/entrance/AuthBrandPanel'
import BrandHero from '@/components/auth/entrance/BrandHero'
import Button from '@/components/auth/entrance/Button'
import Notice from '@/components/auth/entrance/Notice'
import { ENTRANCE_VARS } from '@/components/auth/entrance/entranceVars'
import styles from '@/components/auth/entrance/entrance.module.css'
import { ONBOARDING_VARS } from '@/components/auth/onboarding/onboardingVars'
import { confirmEmailChange } from '@/lib/account/contactChange'
import { ONB_ICONS } from '@/lib/brand/onboardingIcons'
import { auth } from '@/lib/firebase/config'
import { useAuth } from '@/lib/firebase/useAuth'
import { useLang } from '@/lib/i18n/useLang'

// Landing page for the link in the "confirm your new email" message
// (/api/account/change-email). The token is POSTed from here rather than
// applied by a GET, so mail scanners that prefetch links can't use it up.
// Works signed out and on any device; a signed-in tab reloads its Auth
// record so the new address shows at once. Same shell and status badge as
// /verify-email.
function ConfirmEmailChangeContent() {
  const { t, lang, isRtl } = useLang()
  const router = useRouter()
  const token = useSearchParams().get('token')
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(token ? 'verifying' : 'error')
  const [inUse, setInUse] = useState(false)
  // Single use: React StrictMode's double effect in dev must not send it twice.
  const sent = useRef(false)

  useEffect(() => {
    if (!token || sent.current) return
    sent.current = true
    confirmEmailChange(token).then((result) => {
      if (result.ok) {
        setStatus('success')
        auth.currentUser?.reload().then(() => auth.currentUser?.getIdToken(true)).catch(() => {})
      } else {
        setInUse(result.reason === 'emailInUse')
        setStatus('error')
      }
    })
  }, [token])

  const signedIn = !!useAuth().user

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
            <p className="mb-2 text-[15px] font-semibold text-slate-500">{t('confirmEmail_verifying')}</p>
          ) : (
            <>
              <h1 className="text-[24px] leading-8 font-extrabold text-slate-900">
                {t(status === 'success' ? 'confirmEmail_successTitle' : 'confirmEmail_errorTitle')}
              </h1>
              {status === 'success' ? (
                <p className="mt-2 mb-7 text-[15px] leading-6 text-slate-500">{t('confirmEmail_successMessage')}</p>
              ) : (
                <div className="mt-4 mb-3 text-start">
                  <Notice>{t(inUse ? 'contact_err_emailInUse' : 'confirmEmail_errorMessage')}</Notice>
                </div>
              )}
              <Button
                label={t(signedIn ? 'confirmEmail_toProfile' : 'verifyPage_toLogin')}
                onClick={() => router.push(signedIn ? '/profile' : '/login')}
                large
                arrow
              />
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default function ConfirmEmailChangePage() {
  return (
    <Suspense fallback={null}>
      <ConfirmEmailChangeContent />
    </Suspense>
  )
}
