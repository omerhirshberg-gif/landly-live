'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { browserLocalPersistence, browserSessionPersistence, setPersistence } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { signInCustomerWithEmail, type CustomerSignInResult } from '@/lib/auth/signInCustomer'
import { completeGoogleRedirect, hasPendingGoogleRedirect, isEmbeddedBrowser, startGoogleWebSignIn } from '@/lib/auth/googleWebSignIn'
import {
  cancelPasskeyRequest,
  hasPasskeyHint,
  passkeySupport,
  signInWithPasskey,
  type PasskeyErrorCode,
  type PasskeySignInOutcome,
  type PasskeySupport,
} from '@/lib/auth/passkeyClient'
import {
  greetingName,
  isOnboardingComplete,
  parseOnboardingDraft,
  signUpFormError,
  type OnboardingDraft,
  type OnboardingStep,
  type SignUpFormError,
} from '@/lib/auth/onboarding'
import { ONB } from '@/lib/brand/onboardingMotion'
import { signUpCustomer } from '@/lib/auth/signUpCustomer'
import { safeRedirectPath } from '@/lib/auth/safeRedirect'
import { isStrongPassword } from '@/lib/auth/passwordValidation'
import type { SignInMethod } from '@/lib/auth/brandPanelSteps'
import { getUserDocument } from '@/lib/firebase/users'
import { useAuth } from '@/lib/firebase/useAuth'
import type { Lang, TranslationKey } from '@/lib/i18n/translations'
import { useLang } from '@/lib/i18n/useLang'
import BackToHomeLink from '../BackToHomeLink'
import BusinessAccountNotice from '../BusinessAccountNotice'
import GoogleButton from '../GoogleButton'
import PasskeyButton from '../PasskeyButton'
import VerifyEmailNotice, { type PendingVerification } from '../VerifyEmailNotice'
import OnboardingWizard, { readOnboardingDraft } from '../onboarding/OnboardingWizard'
import PasswordRequirements from '../onboarding/PasswordRequirements'
import AuthBrandPanel from './AuthBrandPanel'
import BrandHero, { type EntranceMode } from './BrandHero'
import Button from './Button'
import Checkbox from './Checkbox'
import Notice from './Notice'
import SegmentedControl from './SegmentedControl'
import TextField from './TextField'
import ConsentText from './ConsentText'
import { ENTRANCE_VARS } from './entranceVars'
import { ONBOARDING_VARS } from '../onboarding/onboardingVars'
import styles from './entrance.module.css'

type Mode = 'signIn' | 'signUp'

const PATHS: Record<Mode, string> = { signIn: '/login', signUp: '/signup' }
// Where a finished sign-in (or the wizard after it) goes: the page's
// ?redirect= when it's a same-site path (e.g. the /olim mentor gate, an
// offer's member gate), else home. Read when needed, so it is always the URL
// the browser is on.
const redirectParam = () => new URLSearchParams(window.location.search).get('redirect')
const destination = () => safeRedirectPath(redirectParam())

const PASSKEY_ERRORS: Record<PasskeyErrorCode, TranslationKey> = {
  unknown_credential: 'passkey_err_unknown',
  unverified: 'passkey_err_unverified',
  account_disabled: 'passkey_err_disabled',
  already_registered: 'passkey_err_failed',
  rate_limited: 'passkey_err_rateLimited',
  unavailable: 'passkey_err_unavailable',
  failed: 'passkey_err_failed',
}
// After this many cancelled or failed passkey attempts in a row, the button
// gets a nudge towards email and password and stops leading the card.
const PASSKEY_TROUBLE_AFTER = 3

// Web counterpart of the Expo login screen (landly-mobile/src/app/(auth)/
// login.tsx): brand hero, a floating card with Sign In / Sign Up tabs, and a
// footer link, in the site language and direction. /login and /signup both
// render it; switching tabs only rewrites the URL, so the hero never replays.
// Both tabs share one hero above the card and one tab control inside it, so
// switching never re-mounts either. Sign Up asks for the name and
// credentials; the OnboardingWizard (welcome, language, persona, WhatsApp,
// notifications, celebration) runs after a sign-in that hasn't finished it, in
// a compact layout with no hero so every card fits a phone screen without
// scrolling. The screen fades out before switching to the wizard and before
// leaving for home, so neither change is a cut.
//
// From 1024px wide it's a split screen: AuthBrandPanel (logo, promises, the
// step list) on one side, the same card on the other, for the tabs and the
// wizard alike; below that it's the phone layout above, unchanged.
//
// Arriving already signed in (a reload mid-wizard, or a member page sending
// a member back): unfinished onboarding reopens the wizard at the card the
// member left (its draft on this browser); otherwise it goes home.
export default function AuthScreen({ initialMode }: { initialMode: Mode }) {
  const { t, lang, isRtl, setLang } = useLang()
  const router = useRouter()
  const [entrance, setEntrance] = useState<EntranceMode>('pending')
  const [mode, setMode] = useState<Mode>(initialMode)
  const [rememberMe, setRememberMe] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [businessAccount, setBusinessAccount] = useState(false)
  const [pending, setPending] = useState<PendingVerification | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)
  // Google refuses sign-in inside in-app browsers (Instagram, Facebook, ...):
  // tapping the button there explains how to open the page in a real browser.
  const [inAppNotice, setInAppNotice] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  // A Google redirect sign-in (the popup fallback) lands back here; its result
  // is handled before the restore below looks at the session, so a new
  // member goes through the same customer rules and into the wizard.
  const [redirectChecked, setRedirectChecked] = useState(false)
  const redirectStarted = useRef(false)
  // Back from a Google redirect started here: the card says sign-in is being
  // finished instead of staying hidden while the result is fetched (capped
  // by REDIRECT_RESULT_TIMEOUT_MS, then the form returns with an error).
  const [finishingGoogle, setFinishingGoogle] = useState(false)
  // A Google sign-up skips verification, so the brand panel's journey moves straight to Personalize.
  const [via, setVia] = useState<SignInMethod>('email')
  const [confirm, setConfirm] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [signUpError, setSignUpError] = useState<SignUpFormError | null>(null)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  // Optional and unticked by default (Israeli Spam Law / GDPR consent).
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const { user, loading: authLoading, onboardingComplete, setOnboardingComplete } = useAuth()
  // Signed in, but onboarding isn't finished: the card becomes the wizard,
  // starting from the member's saved progress, if any.
  const [wizard, setWizard] = useState<{ uid: string; draft: OnboardingDraft | null } | null>(null)
  const onboarding = wizard !== null
  // The card on screen in the wizard, for the desktop brand panel.
  const [onbStep, setOnbStep] = useState<OnboardingStep>('welcome')
  // Until an existing session has been looked at, nothing but the page shows,
  // so a member who's on their way into the wizard (or home) never sees the form.
  const [restoring, setRestoring] = useState(true)
  const restoreDecided = useRef(false)
  // The member's first name for the wizard's welcome and celebration (null: greet without one).
  const [onboardingName, setOnboardingName] = useState<string | null>(null)
  // The screen is fading out ahead of a switch (into the wizard, or to home).
  const [leaving, setLeaving] = useState(false)
  const leaveTimer = useRef<number | undefined>(undefined)
  // Passkeys (Sign In tab only): the button, shown when the browser supports
  // WebAuthn, and the email field's autofill, armed in the background where
  // the browser offers passkeys among its suggestions. A browser that made or
  // used a Landly passkey before puts the button above the form.
  const [passkey, setPasskey] = useState<PasskeySupport>({ webauthn: false, autofill: false })
  const [passkeyFirst, setPasskeyFirst] = useState(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [passkeyFailures, setPasskeyFailures] = useState(0)
  // Bumped to arm the autofill request again (after the button, or an expired challenge).
  const [autofillRound, setAutofillRound] = useState(0)
  // Read when a passkey sign-in completes, which can be long after it was armed.
  const rememberRef = useRef(rememberMe)
  rememberRef.current = rememberMe

  useEffect(() => () => window.clearTimeout(leaveTimer.current), [])

  const openWizard = (uid: string) => {
    const draft = parseOnboardingDraft(readOnboardingDraft(uid))
    setOnbStep(draft?.step ?? 'welcome')
    setWizard({ uid, draft })
  }

  // Decided once, on the session the page loaded with; sign-ins made here go through afterSignIn.
  useEffect(() => {
    if (redirectStarted.current) return
    redirectStarted.current = true
    if (hasPendingGoogleRedirect()) setFinishingGoogle(true)
    completeGoogleRedirect(lang)
      .then(async (result) => {
        if (!result) return
        restoreDecided.current = true
        setVia('google')
        await handleGoogleResult(result, { fade: false })
        setRestoring(false)
      })
      .catch((err) => {
        restoreDecided.current = true
        setError(getAuthErrorMessage(err))
        setRestoring(false)
      })
      .finally(() => {
        setRedirectChecked(true)
        setFinishingGoogle(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page load, in the language it loaded with
  }, [])

  useEffect(() => {
    if (restoreDecided.current || authLoading) return
    // Nobody signed in: the form can show without waiting on the redirect
    // check; a result that still arrives goes through handleGoogleResult.
    if (!user?.emailVerified) {
      restoreDecided.current = true
      setRestoring(false)
      return
    }
    if (!redirectChecked) return
    if (onboardingComplete === null) return
    restoreDecided.current = true
    if (onboardingComplete) {
      router.replace(destination())
      return
    }
    const uid = user.uid
    getUserDocument(uid)
      .catch(() => null)
      .then((doc) => {
        setOnboardingName(greetingName(doc, user.displayName))
        openWizard(uid)
        setRestoring(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openWizard only reads storage and sets state
  }, [authLoading, user, onboardingComplete, router, redirectChecked])

  const fadeOutThen = (next: () => void) => {
    setLeaving(true)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(next, reduced ? ONB.reducedMs : ONB.screenOutMs)
  }

  // The staged intro plays every time the screen opens (each arrival at
  // /login or /signup); switching tabs never re-mounts it, so it never
  // replays mid-visit. It starts after mount: until then the hero and card
  // stay hidden, and the intro's first frame is blank anyway.
  useEffect(() => {
    setEntrance('intro')
  }, [])

  // In-app browsers (Instagram, Facebook, ...) can't reach the member's
  // password manager, so they get no passkey controls.
  useEffect(() => {
    if (isEmbeddedBrowser(navigator.userAgent)) return
    let cancelled = false
    passkeySupport().then((support) => {
      if (cancelled) return
      setPasskey(support)
      setPasskeyFirst(support.webauthn && hasPasskeyHint())
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Back from a ?redirect= page should return to where the guest was, not to
  // this screen (which would only bounce a signed-in member onwards), so that
  // trip replaces it in history.
  const goToDestination = () => {
    if (redirectParam()) router.replace(destination())
    else router.push(destination())
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setBusinessAccount(false)
    setSignUpError(null)
    // The query (?redirect=) carries over to the other tab.
    window.history.replaceState(null, '', PATHS[next] + window.location.search)
  }

  // Where a successful sign-in goes: destination(), or the wizard first if
  // onboarding was never finished (new accounts always start there).
  // `fade: false` after a redirect, where there's no form on screen to fade from.
  const afterSignIn = async (uid: string, preferredLanguage: Lang | null, { fade = true } = {}) => {
    if (preferredLanguage) setLang(preferredLanguage)
    const doc = await getUserDocument(uid)
    const complete = isOnboardingComplete(doc)
    // The doc may have only just been created, so this read is the one the guards go by.
    setOnboardingComplete(complete)
    if (complete) {
      goToDestination()
      return
    }
    setOnboardingName(greetingName(doc, auth.currentUser?.displayName))
    if (!fade) {
      openWizard(uid)
      return
    }
    fadeOutThen(() => {
      openWizard(uid)
      setLeaving(false)
    })
  }

  // The popup and redirect paths end the same way.
  const handleGoogleResult = async (result: CustomerSignInResult, options?: { fade: boolean }) => {
    if (result.status === 'businessAccount') setBusinessAccount(true)
    else if (result.status === 'signedIn') {
      setVia('google')
      await afterSignIn(result.user.uid, result.preferredLanguage, options)
    }
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
    const invalid = signUpFormError({ firstName, lastName, email, password, confirm, agreedToTerms })
    setSignUpError(invalid)
    if (invalid) return
    setSubmitting(true)
    try {
      const result = await signUpCustomer({ firstName, lastName, agreedToTerms, marketingOptIn }, email.trim(), password, lang)
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
    if (isEmbeddedBrowser(navigator.userAgent)) {
      setInAppNotice(true)
      return
    }
    setGoogleBusy(true)
    let redirecting = false
    try {
      const outcome = await startGoogleWebSignIn(lang, rememberMe ? browserLocalPersistence : browserSessionPersistence)
      if (outcome.kind === 'redirecting') redirecting = true
      else await handleGoogleResult(outcome.result)
    } catch (err) {
      // A second tap while the popup opens supersedes the first: nothing to report.
      if ((err as { code?: unknown } | null)?.code !== 'auth/cancelled-popup-request') setError(getAuthErrorMessage(err))
    } finally {
      // Leaving for Google: keep the buttons disabled until the page unloads.
      if (!redirecting) setGoogleBusy(false)
    }
  }

  const passkeyPersistence = () => (rememberRef.current ? browserLocalPersistence : browserSessionPersistence)

  const noteFailedPasskey = () =>
    setPasskeyFailures((n) => {
      if (n + 1 >= PASSKEY_TROUBLE_AFTER) setPasskeyFirst(false)
      return n + 1
    })

  // The button and the autofill end the same way.
  const handlePasskeyOutcome = async (outcome: PasskeySignInOutcome) => {
    if (outcome.kind === 'error') {
      setError(t(PASSKEY_ERRORS[outcome.code]))
      noteFailedPasskey()
      return
    }
    if (outcome.kind !== 'signedIn') return
    if (outcome.result.status === 'businessAccount') {
      setBusinessAccount(true)
      return
    }
    if (outcome.result.status === 'signedIn') {
      setPasskeyFailures(0)
      await afterSignIn(outcome.result.user.uid, outcome.result.preferredLanguage)
    }
  }

  const handlePasskey = async () => {
    setError(null)
    setBusinessAccount(false)
    // The email field's pending autofill request gives way to the button's.
    cancelPasskeyRequest()
    setPasskeyBusy(true)
    try {
      const outcome = await signInWithPasskey({ autofill: false, lang, persistence: passkeyPersistence })
      if (outcome.kind === 'cancelled') noteFailedPasskey()
      else await handlePasskeyOutcome(outcome)
    } catch (err) {
      setError(getAuthErrorMessage(err))
      noteFailedPasskey()
    } finally {
      setPasskeyBusy(false)
      // Still signed out: offer passkeys in the email field again.
      if (!auth.currentUser) setAutofillRound((r) => r + 1)
    }
  }

  // Armed while the sign-in form is on screen and idle. The request waits
  // until the member picks a passkey from the email field's suggestions; it
  // is cancelled when the form goes away or another sign-in starts. The
  // button cancels it itself (above) and re-arms it when it's done.
  const autofillArmed =
    passkey.autofill && !restoring && !finishingGoogle && mode === 'signIn' && !pending && !wizard && !submitting && !googleBusy
  useEffect(() => {
    if (!autofillArmed) return
    let active = true
    signInWithPasskey({ autofill: true, lang, persistence: passkeyPersistence })
      .then(async (outcome) => {
        if (!active || outcome.kind === 'cancelled') return
        if (outcome.kind === 'expired') {
          setAutofillRound((r) => r + 1)
          return
        }
        setError(null)
        setBusinessAccount(false)
        await handlePasskeyOutcome(outcome)
        if (outcome.kind === 'error') setAutofillRound((r) => r + 1)
      })
      .catch((err) => {
        if (active) setError(getAuthErrorMessage(err))
      })
    return () => {
      active = false
      cancelPasskeyRequest()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-armed by autofillRound; the handlers read refs and current state
  }, [autofillArmed, autofillRound])

  const copyPageLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopied(true)
    } catch {
      // Clipboard blocked (common in in-app browsers): the notice still says what to do.
    }
  }

  // The celebration's "Let's explore": fade the screen out, then go home
  // (whose greeting fades in on arrival), or back to the ?redirect= page.
  const handleWizardComplete = () => fadeOutThen(goToDestination)

  // Back from "check your inbox": land on Sign In with the email filled in.
  const handleBackToSignIn = () => {
    if (pending) setEmail(pending.email)
    setPassword('')
    setConfirm('')
    setPending(null)
    switchMode('signIn')
  }

  const signUp = mode === 'signUp'
  const busy = submitting || googleBusy || passkeyBusy
  const passkeyButton = passkey.webauthn && !signUp && (
    <>
      <PasskeyButton
        label={t('login_passkeyBtn')}
        busyLabel={t('login_passkeyBusy')}
        busy={passkeyBusy}
        onClick={handlePasskey}
        disabled={submitting || googleBusy}
      />
      {passkeyFailures >= PASSKEY_TROUBLE_AFTER && (
        <p role="status" className="mt-2 text-center text-[13px] font-semibold text-slate-500">
          {t('login_passkeyTrouble')}
        </p>
      )}
    </>
  )
  const divider = (
    <div className="flex items-center gap-3 mt-[18px] mb-3.5">
      <div className="h-px flex-1 bg-slate-200" />
      <span className="text-xs font-semibold text-slate-400 uppercase">{t('login_orDivider')}</span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  )

  const shown: EntranceMode = restoring && !finishingGoogle ? 'pending' : entrance

  return (
    <div
      className={`${styles.root} ${onboarding ? styles.compact : ''}`}
      data-entrance={shown}
      style={{ ...ENTRANCE_VARS, ...ONBOARDING_VARS }}
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={lang}
    >
      <AuthBrandPanel context={onboarding ? onbStep : pending ? 'verify' : mode} via={via} entrance={shown} />

      <main className={styles.main} data-leaving={leaving ? '' : undefined}>
        {!onboarding && (
          <div className={`${styles.chrome} ${styles.backSlot}`}>
            <BackToHomeLink label={t('auth_backHome')} />
          </div>
        )}

        <div className={styles.heroSlot}>
          <BrandHero mode={shown} />
        </div>

        <div className={styles.card}>
          {finishingGoogle ? (
            <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 py-10 text-center">
              <span aria-hidden="true" className="h-8 w-8 rounded-full border-[3px] border-brand border-r-transparent animate-spin" />
              <p className="text-[15px] font-semibold text-slate-600">{t('auth_googleFinishing')}</p>
            </div>
          ) : wizard ? (
            <OnboardingWizard uid={wizard.uid} name={onboardingName} draft={wizard.draft} onStepChange={setOnbStep} onComplete={handleWizardComplete} />
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
                  {/* Side by side from 360px up, stacked on the narrowest phones. */}
                  <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-x-3">
                    <TextField
                      label={t('onb_firstNameLabel')}
                      icon="user"
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value)
                        setSignUpError(null)
                      }}
                      error={signUpError === 'onb_firstNameRequired' ? t(signUpError) : undefined}
                      autoComplete="given-name"
                      autoCapitalize="words"
                      enterKeyHint="next"
                      maxLength={50}
                    />
                    <TextField
                      label={t('onb_lastNameLabel')}
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value)
                        setSignUpError(null)
                      }}
                      error={signUpError === 'onb_lastNameRequired' ? t(signUpError) : undefined}
                      autoComplete="family-name"
                      autoCapitalize="words"
                      enterKeyHint="next"
                      maxLength={50}
                    />
                  </div>
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
                    // The checklist replaces the one-line error while focused, and
                    // the error comes back on blur if the password is still weak.
                    onFocus={() => {
                      setPasswordFocused(true)
                      if (signUpError === 'onb_passwordWeak') setSignUpError(null)
                    }}
                    onBlur={() => {
                      setPasswordFocused(false)
                      if (password && !isStrongPassword(password) && !signUpError) setSignUpError('onb_passwordWeak')
                    }}
                    error={signUpError === 'onb_passwordWeak' ? t(signUpError) : undefined}
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
                      setSignUpError(null)
                    }}
                    error={signUpError === 'onb_passwordMismatch' ? t(signUpError) : undefined}
                    autoComplete="new-password"
                    enterKeyHint="go"
                  />

                  <div className="mt-1 mb-5">
                    <Checkbox
                      label={<span className="leading-5"><ConsentText template={t('signup_terms_agree')} t={t} /></span>}
                      checked={agreedToTerms}
                      onChange={(checked) => {
                        setAgreedToTerms(checked)
                        if (signUpError === 'signup_termsRequired') setSignUpError(null)
                      }}
                      invalid={signUpError === 'signup_termsRequired'}
                      describedBy={signUpError === 'signup_termsRequired' ? 'signup-terms-error' : undefined}
                    />
                    {signUpError === 'signup_termsRequired' && (
                      <p id="signup-terms-error" role="alert" className="mt-2 text-[13px] font-semibold text-red-600">
                        {t('signup_termsRequired')}
                      </p>
                    )}
                    {/* 24px apart, so the two boxes' padded hit areas never overlap. */}
                    <div className="mt-6">
                      <Checkbox
                        label={<span className="leading-5">{t('signup_marketing_optin')}</span>}
                        checked={marketingOptIn}
                        onChange={setMarketingOptIn}
                      />
                    </div>
                  </div>

                  <div>
                    <Button
                      type="submit"
                      label={submitting ? t('onb_createAccountBusy') : t('onb_createAccount')}
                      busy={submitting}
                      disabled={!firstName.trim() || !lastName.trim() || !email || !password || !confirm || googleBusy}
                      large
                      arrow
                    />
                  </div>
                </form>
              ) : (
                <form noValidate onSubmit={handleSubmit}>
                  {passkeyFirst && passkeyButton && (
                    <>
                      {passkeyButton}
                      {divider}
                    </>
                  )}
                  {/* "webauthn" last, so the browser offers saved passkeys in this field's suggestions. */}
                  <TextField
                    label={t('login_emailLabel')}
                    icon="mail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoCapitalize="none"
                    autoComplete="username webauthn"
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
                    disabled={!email || !password || googleBusy || passkeyBusy}
                    large
                    arrow
                  />
                </form>
              )}

              {divider}
              {inAppNotice && (
                <Notice tone="info">
                  <p>{t('auth_inAppBrowser_body')}</p>
                  <button type="button" onClick={copyPageLink} className="mt-2 underline underline-offset-2">
                    {t(linkCopied ? 'auth_inAppBrowser_copied' : 'auth_inAppBrowser_copy')}
                  </button>
                </Notice>
              )}
              <GoogleButton label={t(signUp ? 'signup_googleBtn' : 'login_googleBtn')} onClick={handleGoogle} disabled={busy} />
              {!passkeyFirst && passkeyButton && <div className="mt-3">{passkeyButton}</div>}
              {/* On both tabs: Google from either one can create an account. */}
              <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                <ConsentText template={t('auth_google_disclosure')} t={t} />
              </p>
            </>
          )}
        </div>

        {!pending && !onboarding && !finishingGoogle && (
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
