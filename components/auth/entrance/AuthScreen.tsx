'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { browserLocalPersistence, browserSessionPersistence, setPersistence, signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase/config'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { finishCustomerGoogleSignIn, signInCustomerWithEmail } from '@/lib/auth/signInCustomer'
import { EnglishOnly } from '@/lib/i18n/LangProvider'
import { useLang } from '@/lib/i18n/useLang'
import BackToHomeLink from '../BackToHomeLink'
import BusinessAccountNotice from '../BusinessAccountNotice'
import GoogleButton from '../GoogleButton'
import VerifyEmailNotice from '../VerifyEmailNotice'
import BrandHero, { type EntranceMode } from './BrandHero'
import Button from './Button'
import Checkbox from './Checkbox'
import Notice from './Notice'
import SegmentedControl from './SegmentedControl'
import SignUpForm, { type PendingVerification } from './SignUpForm'
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
// footer link — English-only, like the app. /login and /signup both render
// it; switching tabs only rewrites the URL, so the hero never replays.
export default function AuthScreen({ initialMode }: { initialMode: Mode }) {
  return (
    <EnglishOnly>
      <AuthScreenContent initialMode={initialMode} />
    </EnglishOnly>
  )
}

function AuthScreenContent({ initialMode }: { initialMode: Mode }) {
  const { t, appLang, setLang } = useLang()
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
    window.history.replaceState(null, '', PATHS[next])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusinessAccount(false)
    setSubmitting(true)
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
      // The real site language, not this screen's forced English: the
      // account's saved preference is applied only if it differs from it.
      const result = await signInCustomerWithEmail(email.trim(), password, appLang)
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
      if (result.preferredLanguage) setLang(result.preferredLanguage)
      router.push('/')
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setBusinessAccount(false)
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
      const result = await finishCustomerGoogleSignIn(await signInWithPopup(auth, googleProvider), appLang)
      if (result.status === 'businessAccount') {
        setBusinessAccount(true)
        return
      }
      if (result.status === 'signedIn' && result.preferredLanguage) setLang(result.preferredLanguage)
      router.push('/')
    } catch (err) {
      setError(getAuthErrorMessage(err))
    }
  }

  // Back from "check your inbox": land on Sign In with the email filled in.
  const handleBackToSignIn = () => {
    if (pending) setEmail(pending.email)
    setPassword('')
    setPending(null)
    switchMode('signIn')
  }

  return (
    <div className={styles.root} data-entrance={entrance} style={ENTRANCE_VARS} dir="ltr" lang="en">
      <main className={styles.main}>
        <div className={styles.chrome}>
          <BackToHomeLink label={t('auth_backHome')} />
        </div>

        <div className={styles.heroSlot}>
          <BrandHero mode={entrance} />
        </div>

        <div className={styles.card}>
          {pending ? (
            <VerifyEmailNotice
              variant={pending.variant}
              email={pending.email}
              idToken={pending.idToken}
              initialResult={pending.initialResult}
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

              {mode === 'signIn' ? (
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
                    disabled={!email || !password}
                    large
                    arrow
                  />
                </form>
              ) : (
                <SignUpForm onPendingVerification={setPending} />
              )}

              <div className="flex items-center gap-3 my-5">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold text-slate-400 uppercase">{t('login_orDivider')}</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <GoogleButton label={t(mode === 'signIn' ? 'login_googleBtn' : 'signup_googleBtn')} onClick={handleGoogle} disabled={submitting} />
            </>
          )}
        </div>

        {!pending && (
          <div className={`${styles.chrome} flex flex-wrap items-center justify-center gap-1.5 mt-6`}>
            <span className="text-sm text-slate-500">{t(mode === 'signIn' ? 'login_noAccount' : 'signup_haveAccount')}</span>
            <button
              type="button"
              onClick={() => switchMode(mode === 'signIn' ? 'signUp' : 'signIn')}
              className="py-3 -my-3 text-sm font-bold text-brand cursor-pointer hover:underline"
            >
              {t(mode === 'signIn' ? 'login_signupLink' : 'signup_loginLink')}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
