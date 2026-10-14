'use client'

import { useRouter } from 'next/navigation'
import BackToHomeLink from '@/components/auth/BackToHomeLink'
import AuthBrandPanel from '@/components/auth/entrance/AuthBrandPanel'
import BrandHero from '@/components/auth/entrance/BrandHero'
import Button from '@/components/auth/entrance/Button'
import { ENTRANCE_VARS } from '@/components/auth/entrance/entranceVars'
import styles from '@/components/auth/entrance/entrance.module.css'
import { ONBOARDING_VARS } from '@/components/auth/onboarding/onboardingVars'
import { ONB_ICONS } from '@/lib/brand/onboardingIcons'
import { useLang } from '@/lib/i18n/useLang'

// Purely static confirmation — no oobCode reading, no Firebase Auth calls.
// /reset-password sends members here once confirmPasswordReset succeeds.
// Reset emails sent before links pointed at /reset-password used this page as
// the continueUrl of Firebase's hosted __/auth/action widget, which had
// already used up the code, so it must never try to re-validate one.
//
// Same shell as /verify-email: brand panel beside the card from 1024px, hero
// above it below that, and the onboarding celebration badge.
export default function ResetPasswordSuccessPage() {
  const { t, lang, isRtl } = useLang()
  const router = useRouter()

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

        <div className={`${styles.card} text-center`}>
          <div className={styles.badgeWrap} aria-hidden="true">
            <span className={styles.halo} />
            <span className={styles.badge}>
              <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round">
                <path d={ONB_ICONS.check} />
              </svg>
            </span>
          </div>
          <h1 className="text-[24px] leading-8 font-extrabold text-slate-900">{t('resetSuccess_title')}</h1>
          <p className="mt-2 mb-7 text-[15px] leading-6 text-slate-500">{t('resetSuccess_message')}</p>
          <Button label={t('resetSuccess_backToLogin')} onClick={() => router.push('/login')} large arrow />
        </div>
      </main>
    </div>
  )
}
