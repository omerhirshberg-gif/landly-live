'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BackToHomeLink from '@/components/auth/BackToHomeLink'
import AuthBrandPanel from '@/components/auth/entrance/AuthBrandPanel'
import BrandHero from '@/components/auth/entrance/BrandHero'
import Button from '@/components/auth/entrance/Button'
import Notice from '@/components/auth/entrance/Notice'
import TextField from '@/components/auth/entrance/TextField'
import { ENTRANCE_VARS } from '@/components/auth/entrance/entranceVars'
import styles from '@/components/auth/entrance/entrance.module.css'
import { ONBOARDING_VARS } from '@/components/auth/onboarding/onboardingVars'
import { useLang } from '@/lib/i18n/useLang'

// Asks /api/auth/forgot-password to email a reset link. The link opens our
// own /reset-password page (the route builds it from Firebase's oobCode), and
// the reply is the same whether or not the address has an account.
//
// Same shell as /verify-email and AuthScreen (/login, /signup): the brand
// panel beside the card from 1024px, the hero above it below that, in the
// site language and direction. Once sent, the card turns into the inbox badge.
// The envelope from TextField's mail icon, for the "check your inbox" badge.
const MAIL = 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7'

export default function ForgotPasswordPage() {
  const { t, lang, isRtl } = useLang()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang }),
        // The route holds every reply for 2s; past this, show the error rather
        // than a spinner that never ends.
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) throw new Error('request failed')
      setSent(true)
    } catch {
      setError(t('forgot_error_generic'))
    } finally {
      setSubmitting(false)
    }
  }

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

        {sent ? (
          <div className={`${styles.card} text-center`} aria-live="polite">
            <div className={styles.badgeWrap} aria-hidden="true">
              <span className={styles.halo} />
              <span className={styles.badge}>
                <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
                  <path d={MAIL} />
                </svg>
              </span>
            </div>
            <h1 className="text-2xl leading-8 font-extrabold text-slate-900">{t('forgot_sentTitle')}</h1>
            <p className="mt-2 mb-7 text-copy leading-6 text-slate-500">{t('forgot_sentSubtitle')}</p>
            <Button label={t('forgot_backLink')} onClick={() => router.push('/login')} large arrow />
          </div>
        ) : (
          <div className={styles.card}>
            <h1 className="text-2xl leading-8 font-extrabold text-slate-900">{t('forgot_title')}</h1>
            <p className={`${styles.subtitle} mt-2 mb-6 text-copy leading-6 text-slate-500`}>{t('forgot_subtitle')}</p>

            {error && <Notice>{error}</Notice>}

            <form onSubmit={handleSubmit}>
              <TextField
                label={t('forgot_emailLabel')}
                icon="mail"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                enterKeyHint="send"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                hint={t('forgot_privacyNote')}
              />
              <div className="mt-1">
                <Button type="submit" label={t(submitting ? 'forgot_submitBtnBusy' : 'forgot_submitBtn')} busy={submitting} large />
              </div>
            </form>

            <div className="mt-6 text-center text-sm">
              <Link href="/login" className="py-3 -my-3 font-bold text-brand hover:underline">
                {t('forgot_backLink')}
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
