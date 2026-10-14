'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithPopup,
} from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase/config'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { finishCustomerGoogleSignIn, signInCustomerWithEmail } from '@/lib/auth/signInCustomer'
import { isProfileComplete, passwordStrength, signUpFormError } from '@/lib/auth/onboarding'
import { signUpCustomer } from '@/lib/auth/signUpCustomer'
import { getUserDocument } from '@/lib/firebase/users'
import type { Lang } from '@/lib/i18n/translations'
import { useLang } from '@/lib/i18n/useLang'
import BackToHomeLink from '../BackToHomeLink'
import BusinessAccountNotice from '../BusinessAccountNotice'
import GoogleButton from '../GoogleButton'
import VerifyEmailNotice, { type PendingVerification } from '../VerifyEmailNotice'
import OnboardingWizard from '../onboarding/OnboardingWizard'
import PasswordStrengthMeter from '../onboarding/PasswordStrengthMeter'
import BrandHero, { type EntranceMode } from './BrandHero'
import Button from './Button'
import Checkbox from './Checkbox'
import Notice from './Notice'
import SegmentedControl from './SegmentedControl'
import TextField from './TextField'
import { ENTRANCE_VARS } from './entranceVars'
import styles from './entrance.module.css'

type Mode = 'signIn' | 'signUp'

const PATHS: Record<Mode, string> = { signIn: '/login', signUp: '/signup' }
// The staged intro plays once per browser session; later visits get the
// settled hero and just the card entrance.
const INTRO_SEEN_KEY = 'landly_auth_intro_seen'

// Web counterpart of the Expo login screen (landly-mobile/src/app/(auth)/
// login.tsx): brand hero, a floating card with Sign In / Sign Up tabs, and a
// footer link, in the site language and direction. /login and /signup both
// render it; switching tabs only rewrites the URL, so the hero never replays.
// Both tabs share one hero above the card and one tab control inside it, so
// switching never re-mounts either. Sign Up asks for credentials only; the
// OnboardingWizard (language, persona, WhatsApp, notifications) runs after a
// sign-in whose profile is incomplete, in a compact layout with no hero so
// every card fits a phone screen without scrolling.
export default function AuthScreen({ initialMode }: { initialMode: Mode }) {
  const { t, lang, isRtl, setLang } = useLang()
  const router = useRouter()
  const [entrance, setEntrance] = useState<EntranceMode>('pending')
  const decided = useRef(false)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [rememberMe, setRememberMe] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [businessAccount, setBusinessAccount] = useState(false)
  const [pending, setPending] = useState<PendingVerification | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [signUpError, setSignUpError] = useState<ReturnType<typeof signUpFormError>>(null)
  // Signed in, but the profile still lacks persona / phone: the card becomes the wizard.
  const [onboarding, setOnboarding] = useState(false)

  // sessionStorage only exists in the browser, so the choice is made after
  // mount; until then the hero and card stay hidden (the intro's first frame
  // is blank anyway). The ref keeps Strict Mode's second effect run from
  // reading the flag this run just wrote.
  useEffect(() => {
    if (decided.current) return
    decided.current = true
    let seen = false
    try {
      seen = sessionStorage.getItem(INTRO_SEEN_KEY) === '1'
      sessionStorage.setItem(INTRO_SEEN_KEY, '1')
    } catch {
      // Storage blocked — play the intro, it just won't be remembered
    }
    setEntrance(seen ? 'settled' : 'intro')
  }, [])

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setBusinessAccount(false)
    setSignUpError(null)
    window.history.replaceState(null, '', PATHS[next])
  }

  // Where a successful sign-in goes: home, or the wizard first if the
  // profile was never finished (new accounts always start there).
  const afterSignIn = async (uid: string, preferredLanguage: Lang | null) => {
    if (preferredLanguage) setLang(preferredLanguage)
    if (isProfileComplete(await getUserDocument(uid))) router.push('/')
    else setOnboarding(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusinessAccount(false)
    setSubmitting(true)
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
      // The account's saved language is applied only if it differs from the current one.
      const result = await signInCustomerWithEmail(email.trim(), password, lang)
      if (result.status === 'businessAccount') {
        setBusinessAccount(true)
        setSubmitting(false)
        return
      }
      if (result.status === 'unverified') {
        setPending({ variant: 'login', email: result.email, idToken: result.idToken })
        setSubmitting(false)
        return
      }
      await afterSignIn(result.user.uid, result.preferredLanguage)
      setSubmitting(false)
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setSubmitting(false)
    }
  }

  // Credentials only. Email+password accounts stay locked until the emailed
  // link is clicked: signUpCustomer creates the account and signs straight
  // back out, and the "check your inbox" card replaces the form at once while
  // the verification email is still on its way (that request also creates
  // the profile doc). The wizard runs on the first verified sign-in.
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const invalid = signUpFormError(email, password, confirm)
    setSignUpError(invalid)
    if (invalid) return
    setSubmitting(true)
    try {
      const result = await signUpCustomer(email.trim(), password, lang)
      setPending({ variant: 'signup', email: result.email, idToken: result.idToken, initialSend: result.send })
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  // Google from either tab: a new (or never finished) account continues in
  // the wizard; everyone else goes home.
  const handleGoogle = async () => {
    setError(null)
    setBusinessAccount(false)
    setGoogleBusy(true)
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
      const result = await finishCustomerGoogleSignIn(await signInWithPopup(auth, googleProvider), lang)
      if (result.status === 'businessAccount') setBusinessAccount(true)
      else if (result.status === 'signedIn') await afterSignIn(result.user.uid, result.preferredLanguage)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setGoogleBusy(false)
    }
  }

  const handleWizardComplete = () => router.push('/')

  // Back from "check your inbox": land on Sign In with the email filled in.
  const handleBackToSignIn = () => {
    if (pending) setEmail(pending.email)
    setPassword('')
    setConfirm('')
    setPending(null)
    switchMode('signIn')
  }

  const signUp = mode === 'signUp'
  const busy = submitting || googleBusy
  const divider = (
    <div className="flex items-center gap-3 mt-[18px] mb-3.5">
      <div className="h-px flex-1 bg-slate-200" />
      <span className="text-xs font-semibold text-slate-400 uppercase">{t('login_orDivider')}</span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  )

  return (
    <div
      className={`${styles.root} ${onboarding ? styles.compact : ''}`}
      data-entrance={entrance}
      style={ENTRANCE_VARS}
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <main className={styles.main}>
        {!onboarding && (
          <div className={styles.chrome}>
            <BackToHomeLink label={t('auth_backHome')} />
          </div>
        )}

        <div className={styles.heroSlot}>
          <BrandHero mode={entrance} />
        </div>

        <div className={styles.card}>
          {onboarding ? (
            <OnboardingWizard onComplete={handleWizardComplete} />
          ) : pending ? (
            <VerifyEmailNotice
              variant={pending.variant}
              email={pending.email}
              idToken={pending.idToken}
              initialSend={pending.initialSend}
              onBack={handleBackToSignIn}
            />
          ) : (
            <>
              <SegmentedControl
                options={[
                  { value: 'signIn', label: t('login_title') },
                  { value: 'signUp', label: t('signup_title') },
                ]}
                value={mode}
                onChange={switchMode}
                className="mb-6"
              />

              {error && <Notice>{error}</Notice>}
              {businessAccount && (
                <BusinessAccountNotice message={t('login_businessAccountError')} linkLabel={t('login_businessAccountLink')} />
              )}

              {signUp ? (
                <form noValidate onSubmit={handleSignUp}>
                  <TextField
                    label={t('signup_emailLabel')}
                    icon="mail"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setSignUpError(null)
                    }}
                    error={signUpError === 'onb_emailInvalid' ? t(signUpError) : undefined}
                    autoCapitalize="none"
                    autoComplete="email"
                    enterKeyHint="next"
                  />
                  <TextField
                    label={t('onb_createPasswordLabel')}
                    icon="lock"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setSignUpError(null)
                    }}
                    error={signUpError === 'onb_passwordTooShort' ? t(signUpError) : undefined}
                    autoComplete="new-password"
                    enterKeyHint="next"
                  />
                  <PasswordStrengthMeter strength={passwordStrength(password)} />
                  <TextField
                    label={t('onb_confirmPasswordLabel')}
                    icon="lock"
                    type="password"
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value)
                      setSignUpError(null)
                    }}
                    error={signUpError === 'onb_passwordMismatch' ? t(signUpError) : undefined}
                    autoComplete="new-password"
                    enterKeyHint="go"
                  />

                  <div className="mt-1">
                    <Button
                      type="submit"
                      label={submitting ? t('onb_createAccountBusy') : t('onb_createAccount')}
                      busy={submitting}
                      disabled={!email || !password || !confirm || googleBusy}
                      large
                      arrow
                    />
                  </div>
                </form>
              ) : (
                <form noValidate onSubmit={handleSubmit}>
                  <TextField
                    label={t('login_emailLabel')}
                    icon="mail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoCapitalize="none"
                    autoComplete="email"
                    enterKeyHint="next"
                  />
                  <TextField
                    label={t('login_passwordLabel')}
                    icon="lock"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    enterKeyHint="go"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3 -mt-0.5 mb-6">
                    <Checkbox label={t('login_rememberMe')} checked={rememberMe} onChange={setRememberMe} />
                    <Link href="/forgot-password" className="py-3 -my-3 text-[13px] font-bold text-brand hover:underline">
                      {t('login_forgotLink')}
                    </Link>
                  </div>

                  <Button
                    type="submit"
                    label={submitting ? t('login_submitBtnBusy') : t('login_submitBtn')}
                    busy={submitting}
                    disabled={!email || !password || googleBusy}
                    large
                    arrow
                  />
                </form>
              )}

              {divider}
              <GoogleButton label={t(signUp ? 'signup_googleBtn' : 'login_googleBtn')} onClick={handleGoogle} disabled={busy} />
            </>
          )}
        </div>

        {!pending && !onboarding && (
          <div className={`${styles.chrome} flex flex-wrap items-center justify-center gap-1.5 mt-6`}>
            <span className="text-sm text-slate-500">{t(signUp ? 'signup_haveAccount' : 'login_noAccount')}</span>
            <button
              type="button"
              onClick={() => switchMode(signUp ? 'signIn' : 'signUp')}
              className="py-3 -my-3 text-sm font-bold text-brand cursor-pointer hover:underline"
            >
              {t(signUp ? 'signup_loginLink' : 'login_signupLink')}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
