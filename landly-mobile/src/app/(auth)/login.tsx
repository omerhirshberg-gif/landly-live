import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as WebBrowser from 'expo-web-browser'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import { inMemoryPersistence, setPersistence } from 'firebase/auth'
import { greetingName, isOnboardingComplete, signUpFormError, type OnboardingDraft, type SignUpFormError } from '@shared/auth/onboarding'
import { EASE_FADE, EASE_SILK, ONB } from '@shared/brand/onboardingMotion'
import { signInCustomerWithEmail } from '@shared/auth/signInCustomer'
import { signUpCustomer } from '@shared/auth/signUpCustomer'
import { isStrongPassword } from '@shared/auth/passwordValidation'
import { auth, devicePersistence } from '@shared/firebase/config'
import { getAuthErrorMessage } from '@shared/firebase/authErrors'
import { getUserDocument } from '@shared/firebase/users'
import { useAuth } from '@shared/firebase/useAuth'
import type { Lang } from '@shared/i18n/translations'
import { CARD_DELAY_MS, CARD_FADE_MS, CURVES, FROM } from '@shared/brand/entranceTimeline'
import AppText from '../../components/AppText'
import Button from '../../components/Button'
import Checkbox from '../../components/Checkbox'
import ConsentText from '../../components/ConsentText'
import GoogleButton from '../../components/GoogleButton'
import { ENTRANCE_SPRING, useEntrance } from '../../components/Entrance'
import Notice from '../../components/Notice'
import BrandHero from '../../components/BrandHero'
import SegmentedControl from '../../components/SegmentedControl'
import TextField from '../../components/TextField'
import { useSignInGate } from '../../auth/SignInGate'
import { GOOGLE_SIGN_IN_CONFIGURED, signInWithGoogle } from '../../auth/googleSignIn'
import OnboardingWizard from '../../auth/onboarding/OnboardingWizard'
import { loadOnboardingDraft } from '../../auth/onboarding/draftStorage'
import PasswordRequirements from '../../auth/onboarding/PasswordRequirements'
import VerifyEmailCard, { type PendingVerification } from '../../auth/VerifyEmailCard'
import { useLang } from '../../i18n/LangProvider'
import { API_BASE_URL } from '../../lib/env'
import { useKeyboardVisible } from '../../lib/useKeyboardVisible'
import { VIEWPORT_HEIGHT, webOnly } from '../../lib/webStyles'
import { colors } from '../../theme'

// Password reset and business login stay on the website for now.
const openWeb = (path: string) => Linking.openURL(`${API_BASE_URL}${path}`)

// Forgot password opens in an in-app browser sheet (SFSafariViewController /
// Chrome Custom Tabs), so closing it lands back on this screen. Business
// login keeps the system browser above, where business users' web session
// lives. If a sheet can't open (one is already showing), fall back to that.
const openWebSheet = (path: string) =>
  WebBrowser.openBrowserAsync(`${API_BASE_URL}${path}`, {
    controlsColor: colors.brand,
    toolbarColor: colors.white,
    dismissButtonStyle: 'close',
  }).catch(() => openWeb(path))

type Mode = 'signIn' | 'signUp'

const EASE_OUT = Easing.bezier(...CURVES.easeOut)
const SILK = Easing.bezier(...EASE_SILK)
const FADE = Easing.bezier(...EASE_FADE)
// First and last name sit side by side from this window width up.
const NAME_ROW_MIN_WIDTH = 360
// The card rises this far as the splash logo settles into the hero spot.
const CARD_RISE = FROM.cardRise

// Both tabs share one hero above the card and one tab control inside it, so
// switching never re-mounts either (the splash logo may still be landing on
// the hero). Sign Up asks for the name and credentials; the
// OnboardingWizard (welcome, language, persona, origin, WhatsApp, notifications,
// celebration) replaces the card after a sign-in that hasn't finished it,
// with the hero hidden so every card fits the screen without scrolling. The
// card fades out before the wizard appears and again before the tabs do.
//
// Launching with a saved session whose onboarding isn't finished (the root
// layout keeps the tabs closed) lands here too, and goes straight back into
// the wizard at the card the member left (its draft on this device).

export default function LoginScreen() {
  const { t, lang, setLang } = useLang()
  const { setChecking, onboarding, setOnboarding } = useSignInGate()
  const { user, onboardingComplete, setOnboardingComplete } = useAuth()
  const keyboardVisible = useKeyboardVisible()
  const { phase, setHeroRect } = useEntrance()
  const reduced = useReducedMotion()
  const heroRef = useRef<View>(null)
  // Arriving after launch (e.g. after signing out) there's no entrance to play.
  const entering = useRef(phase !== 'done').current
  const cardY = useSharedValue(entering && !reduced ? CARD_RISE : 0)
  const cardOpacity = useSharedValue(entering ? 0 : 1)
  const heroOpacity = useSharedValue(1)
  const [mode, setMode] = useState<Mode>('signIn')
  const [rememberMe, setRememberMe] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [businessAccount, setBusinessAccount] = useState(false)
  const [pending, setPending] = useState<PendingVerification | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [signUpError, setSignUpError] = useState<SignUpFormError | null>(null)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  // The gate closes (`onboarding`) the moment sign-in finds onboarding
  // unfinished; the wizard itself only replaces the card once it has faded out.
  const [wizardShown, setWizardShown] = useState(false)
  const [wizard, setWizard] = useState<{ uid: string; draft: OnboardingDraft | null } | null>(null)
  // A restored session headed for the wizard: the card (and the hero) stay
  // away while its name and draft load, so the form never flashes.
  // The root layout only mounts this screen once that answer is known.
  const [restoring, setRestoring] = useState(() => !!user?.emailVerified && onboardingComplete === false)
  const [onboardingName, setOnboardingName] = useState<string | null>(null)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { width } = useWindowDimensions()
  const nameRow = width >= NAME_ROW_MIN_WIDTH

  useEffect(() => () => clearTimeout(fadeTimer.current), [])

  // Fade the card (and footer) out, rising slightly, then switch what it shows.
  const fadeOutThen = (next: () => void) => {
    const duration = reduced ? ONB.reducedMs : ONB.screenOutMs
    cardOpacity.set(withTiming(0, { duration, easing: FADE }))
    heroOpacity.set(withTiming(0, { duration, easing: FADE }))
    if (!reduced) cardY.set(withTiming(-ONB.screenRisePx, { duration, easing: SILK }))
    clearTimeout(fadeTimer.current)
    fadeTimer.current = setTimeout(next, duration)
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setBusinessAccount(false)
    setSignUpError(null)
  }

  // A signed-in member who hasn't finished onboarding stays behind the gate
  // and gets the wizard; everyone else is let through to the tabs. Runs while
  // the gate is still held closed by `checking`, and closes it for good
  // (`onboarding`) before that's released.
  const afterSignIn = async (uid: string, preferredLanguage: Lang | null) => {
    if (preferredLanguage) setLang(preferredLanguage)
    const doc = await getUserDocument(uid)
    const complete = isOnboardingComplete(doc)
    // The doc may have only just been created, so this read is the one the root layout goes by.
    setOnboardingComplete(complete)
    if (complete) return
    setOnboarding(true)
    setOnboardingName(greetingName(doc, auth.currentUser?.displayName))
    const draft = await loadOnboardingDraft(uid)
    fadeOutThen(() => {
      setWizard({ uid, draft })
      setWizardShown(true)
      setSubmitting(false)
    })
  }

  // Once, for the session the app launched with.
  useEffect(() => {
    if (!restoring || !user) return
    const uid = user.uid
    setOnboarding(true)
    let cancelled = false
    Promise.all([getUserDocument(uid).catch(() => null), loadOnboardingDraft(uid)]).then(([doc, draft]) => {
      if (cancelled) return
      setOnboardingName(greetingName(doc, user.displayName))
      setWizard({ uid, draft })
      setWizardShown(true)
      setRestoring(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs for the launch session only
  }, [])

  const handleSubmit = async () => {
    setError(null)
    setBusinessAccount(false)
    setSubmitting(true)
    setChecking(true)
    try {
      // Same contract as the web login: unchecked keeps the session in memory
      // only, so it ends when the app is closed.
      await setPersistence(auth, rememberMe ? devicePersistence : inMemoryPersistence)
      // The account's saved language is applied only if it differs from the current one.
      const result = await signInCustomerWithEmail(email.trim(), password, lang)
      if (result.status === 'businessAccount') {
        setBusinessAccount(true)
        setSubmitting(false)
      } else if (result.status === 'unverified') {
        setPending({ variant: 'login', email: result.email, idToken: result.idToken })
        setSubmitting(false)
      } else {
        await afterSignIn(result.user.uid, result.preferredLanguage)
      }
      // On success the root layout swaps this screen for the tabs once the gate opens.
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setSubmitting(false)
    } finally {
      setChecking(false)
    }
  }

  // Credentials only. Email+password accounts stay locked until the emailed
  // link is clicked: signUpCustomer creates the account and signs straight
  // back out, and the "check your inbox" card replaces the form at once while
  // the verification email is still on its way (that request also creates
  // the profile doc). The wizard runs on the first verified sign-in.
  const handleSignUp = async () => {
    setError(null)
    const invalid = signUpFormError({ firstName, lastName, email, password, confirm, agreedToTerms })
    setSignUpError(invalid)
    if (invalid) return
    setSubmitting(true)
    // Keeps the root layout from reacting to the brief unverified session.
    setChecking(true)
    try {
      const result = await signUpCustomer({ firstName, lastName, agreedToTerms }, email.trim(), password, lang, API_BASE_URL)
      setPending({ variant: 'signup', email: result.email, idToken: result.idToken, initialSend: result.send })
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setChecking(false)
      setSubmitting(false)
    }
  }

  // Google from either tab. Native builds need an OAuth client ID per
  // platform (see auth/googleSignIn.ts); until then the button explains why.
  const handleGoogle = async () => {
    setError(null)
    setBusinessAccount(false)
    if (!GOOGLE_SIGN_IN_CONFIGURED) {
      setError(t('onb_googleUnavailable'))
      return
    }
    setGoogleBusy(true)
    setChecking(true)
    try {
      await setPersistence(auth, rememberMe ? devicePersistence : inMemoryPersistence)
      const result = await signInWithGoogle(lang)
      if (result.status === 'businessAccount') setBusinessAccount(true)
      else if (result.status === 'signedIn') await afterSignIn(result.user.uid, result.preferredLanguage)
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setChecking(false)
      setGoogleBusy(false)
    }
  }

  // The celebration's "Let's explore": fade out, then open the gate; the
  // tabs fade in (root layout).
  const handleWizardComplete = () => fadeOutThen(() => setOnboarding(false))

  // The wizard rises and fades in once the card behind it has faded out.
  useEffect(() => {
    if (!wizardShown) return
    if (reduced) {
      cardY.set(0)
      cardOpacity.set(withTiming(1, { duration: ONB.reducedMs }))
      return
    }
    cardY.set(ONB.screenRisePx)
    cardY.set(withTiming(0, { duration: ONB.screenInMs, easing: SILK }))
    cardOpacity.set(withTiming(1, { duration: ONB.screenInMs, easing: SILK }))
  }, [wizardShown, reduced, cardY, cardOpacity])

  // The card and top bar rise in while the splash logo glides into the hero.
  useEffect(() => {
    if (!entering || phase !== 'settling') return
    cardY.set(withDelay(CARD_DELAY_MS, withSpring(0, ENTRANCE_SPRING)))
    cardOpacity.set(withDelay(CARD_DELAY_MS, withTiming(1, { duration: CARD_FADE_MS, easing: EASE_OUT })))
  }, [entering, phase, cardY, cardOpacity])

  const riseStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.get(),
    transform: [{ translateY: cardY.get() }],
  }))
  const fadeStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.get() }))
  const heroFadeStyle = useAnimatedStyle(() => ({ opacity: heroOpacity.get() }))

  // Tell the splash where the hero sits so its logo can land exactly on it.
  const reportHero = () => {
    if (phase === 'done') return
    heroRef.current?.measureInWindow((x, y, width, height) => setHeroRect({ x, y, width, height }))
  }

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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Onboarding cards are sized to fit without scrolling (no hero,
            compact header, subtitles dropped while typing); scrolling remains
            only as a fallback for very large accessibility text, and never bounces. */}
        <ScrollView
          contentContainerStyle={[styles.content, wizardShown && styles.contentCompact]}
          keyboardShouldPersistTaps="handled"
          alwaysBounceVertical={false}
        >
          <View style={[styles.main, wizardShown && keyboardVisible && styles.mainTop]}>
            {/* Hidden until the splash hands over: its logo is landing on this exact spot. */}
            {!wizardShown && !restoring && (
              <View
                ref={heroRef}
                collapsable={false}
                onLayout={reportHero}
                style={[styles.header, phase !== 'done' && styles.hidden]}
              >
                {/* Fades out with the card when the wizard takes over. */}
                <Animated.View style={heroFadeStyle}>
                  <BrandHero />
                </Animated.View>
              </View>
            )}

            {!restoring && (
              <Animated.View style={[styles.card, riseStyle]}>
                {wizardShown && wizard ? (
                  <OnboardingWizard uid={wizard.uid} name={onboardingName} draft={wizard.draft} onComplete={handleWizardComplete} />
                ) : pending ? (
                  <VerifyEmailCard pending={pending} onBack={handleBackToSignIn} />
                ) : (
                  <>
                    <SegmentedControl
                      options={[
                        { value: 'signIn', label: t('login_title') },
                        { value: 'signUp', label: t('signup_title') },
                      ]}
                      value={mode}
                      onChange={switchMode}
                      style={styles.modeSwitch}
                    />

                    {error && <Notice message={error} />}
                    {businessAccount && (
                      <View style={styles.businessNotice}>
                        <Notice message={t('login_businessAccountError')} />
                        <Pressable accessibilityRole="link" onPress={() => openWeb('/business/login')} hitSlop={8} style={styles.pointer}>
                          <AppText style={[styles.link, styles.center]}>{t('login_businessAccountLink')}</AppText>
                        </Pressable>
                      </View>
                    )}

                    {signUp ? (
                      <>
                        {/* Side by side from 360px up, stacked on the narrowest phones. */}
                        <View style={nameRow && styles.nameRow}>
                          <View style={nameRow && styles.nameCell}>
                            <TextField
                              label={t('onb_firstNameLabel')}
                              icon="user"
                              natural
                              value={firstName}
                              onChangeText={(v) => {
                                setFirstName(v)
                                setSignUpError(null)
                              }}
                              error={signUpError === 'onb_firstNameRequired' ? t(signUpError) : undefined}
                              autoCapitalize="words"
                              autoComplete="given-name"
                              textContentType="givenName"
                              returnKeyType="next"
                              maxLength={50}
                            />
                          </View>
                          <View style={nameRow && styles.nameCell}>
                            <TextField
                              label={t('onb_lastNameLabel')}
                              natural
                              value={lastName}
                              onChangeText={(v) => {
                                setLastName(v)
                                setSignUpError(null)
                              }}
                              error={signUpError === 'onb_lastNameRequired' ? t(signUpError) : undefined}
                              autoCapitalize="words"
                              autoComplete="family-name"
                              textContentType="familyName"
                              returnKeyType="next"
                              maxLength={50}
                            />
                          </View>
                        </View>
                        <TextField
                          label={t('signup_emailLabel')}
                          icon="mail"
                          value={email}
                          onChangeText={(v) => {
                            setEmail(v)
                            setSignUpError(null)
                          }}
                          error={signUpError === 'onb_emailInvalid' ? t(signUpError) : undefined}
                          autoCapitalize="none"
                          autoComplete="email"
                          keyboardType="email-address"
                          textContentType="emailAddress"
                          returnKeyType="next"
                        />
                        <TextField
                          label={t('onb_createPasswordLabel')}
                          icon="lock"
                          value={password}
                          onChangeText={(v) => {
                            setPassword(v)
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
                          secureTextEntry
                          autoComplete="new-password"
                          textContentType="newPassword"
                          returnKeyType="next"
                        />
                        <PasswordRequirements password={password} visible={passwordFocused} />
                        <TextField
                          label={t('onb_confirmPasswordLabel')}
                          icon="lock"
                          value={confirm}
                          onChangeText={(v) => {
                            setConfirm(v)
                            setSignUpError(null)
                          }}
                          error={signUpError === 'onb_passwordMismatch' ? t(signUpError) : undefined}
                          secureTextEntry
                          autoComplete="new-password"
                          textContentType="newPassword"
                          returnKeyType="go"
                          onSubmitEditing={handleSignUp}
                        />
                        <View style={styles.consent}>
                          <Checkbox
                            label={<ConsentText template={t('signup_terms_agree')} t={t} onOpen={openWebSheet} />}
                            checked={agreedToTerms}
                            onChange={(checked) => {
                              setAgreedToTerms(checked)
                              if (signUpError === 'signup_termsRequired') setSignUpError(null)
                            }}
                            invalid={signUpError === 'signup_termsRequired'}
                          />
                          {signUpError === 'signup_termsRequired' && (
                            <AppText accessibilityRole="alert" style={styles.consentError}>{t('signup_termsRequired')}</AppText>
                          )}
                        </View>
                        <View style={styles.cta}>
                          <Button
                            label={submitting ? t('onb_createAccountBusy') : t('onb_createAccount')}
                            onPress={handleSignUp}
                            busy={submitting}
                            disabled={!firstName.trim() || !lastName.trim() || !email || !password || !confirm || googleBusy}
                            large
                            arrow
                          />
                        </View>
                      </>
                    ) : (
                      <>
                        <TextField
                          label={t('login_emailLabel')}
                          icon="mail"
                          value={email}
                          onChangeText={setEmail}
                          autoCapitalize="none"
                          autoComplete="email"
                          keyboardType="email-address"
                          textContentType="emailAddress"
                          returnKeyType="next"
                        />
                        <TextField
                          label={t('login_passwordLabel')}
                          icon="lock"
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry
                          autoComplete="current-password"
                          textContentType="password"
                          returnKeyType="go"
                          onSubmitEditing={handleSubmit}
                        />
                        <View style={styles.actionRow}>
                          <Checkbox label={t('login_rememberMe')} checked={rememberMe} onChange={setRememberMe} />
                          <Pressable
                            accessibilityRole="link"
                            onPress={() => openWebSheet('/forgot-password')}
                            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                            style={styles.pointer}
                          >
                            <AppText style={styles.forgotText}>{t('login_forgotLink')}</AppText>
                          </Pressable>
                        </View>
                        <Button
                          label={submitting ? t('login_submitBtnBusy') : t('login_submitBtn')}
                          onPress={handleSubmit}
                          busy={submitting}
                          disabled={!email || !password || googleBusy}
                          large
                          arrow
                        />
                      </>
                    )}

                    <View style={styles.divider}>
                      <View style={styles.rule} />
                      <AppText style={styles.or}>{t('login_orDivider')}</AppText>
                      <View style={styles.rule} />
                    </View>
                    <GoogleButton label={t(signUp ? 'signup_googleBtn' : 'login_googleBtn')} onPress={handleGoogle} disabled={busy} />
                    {/* On both tabs: Google from either one can create an account. */}
                    <AppText style={styles.disclosure}>
                      <ConsentText template={t('auth_google_disclosure')} t={t} onOpen={openWebSheet} />
                    </AppText>
                  </>
                )}
              </Animated.View>
            )}

            {!pending && !wizardShown && !restoring && (
              <Animated.View style={[styles.footer, fadeStyle]}>
                <AppText style={styles.muted}>{t(signUp ? 'signup_haveAccount' : 'login_noAccount')}</AppText>
                <Pressable accessibilityRole="link" onPress={() => switchMode(signUp ? 'signIn' : 'signUp')} hitSlop={12} style={styles.pointer}>
                  <AppText style={styles.link}>{t(signUp ? 'signup_loginLink' : 'login_signupLink')}</AppText>
                </Pressable>
              </Animated.View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    // Web: fill the browser viewport and center the column in it.
    ...webOnly({ minHeight: VIEWPORT_HEIGHT, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 }),
  },
  // Onboarding: less vertical padding, so each card fits one screen.
  contentCompact: { paddingTop: 4, paddingBottom: 12, ...webOnly({ paddingTop: 12, paddingBottom: 16 }) },
  main: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 16,
    // Web: one fixed-width column instead of stretching across the viewport.
    ...webOnly({ width: '100%', maxWidth: 440, alignSelf: 'center', marginHorizontal: 'auto' }),
  },
  // With the keyboard up, the step sits at the top of the space left above it.
  mainTop: { justifyContent: 'flex-start', paddingTop: 4 },
  header: { alignSelf: 'center', marginBottom: 24, ...webOnly({ marginBottom: 28 }) },
  hidden: { opacity: 0 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    // Layered: a hairline contact shadow, a soft mid shadow and a wide ambient
    // one. boxShadow renders natively on the New Architecture and on web alike.
    boxShadow:
      '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 20px -4px rgba(15, 23, 42, 0.06), 0 28px 56px -16px rgba(15, 23, 42, 0.14)',
    ...webOnly({ width: '100%', maxWidth: 440, alignSelf: 'center', marginHorizontal: 'auto', padding: 32 }),
  },
  modeSwitch: { marginBottom: 24 },
  nameRow: { flexDirection: 'row', gap: 12 },
  nameCell: { flex: 1, minWidth: 0 },
  cta: { marginTop: 4 },
  consent: { marginTop: 4, marginBottom: 20 },
  consentError: { marginTop: 8, fontSize: 13, fontWeight: '600', color: colors.danger },
  // Centred in both directions (overrides AppText's reading-side alignment).
  disclosure: { marginTop: 12, fontSize: 12, lineHeight: 18, color: colors.textMuted, textAlign: 'center' },
  center: { textAlign: 'center' },
  businessNotice: { marginBottom: 16 },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: -2,
    marginBottom: 24,
  },
  forgotText: { fontSize: 13, fontWeight: '700', color: colors.brand },
  pointer: webOnly({ cursor: 'pointer' }),
  link: { fontSize: 14, fontWeight: '700', color: colors.brand },
  muted: { fontSize: 14, color: colors.textMuted },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginBottom: 14 },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { fontSize: 12, fontWeight: '600', color: colors.textFaint, textTransform: 'uppercase' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 24 },
})
