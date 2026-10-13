import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import { inMemoryPersistence, setPersistence } from 'firebase/auth'
import { signInCustomerWithEmail } from '@shared/auth/signInCustomer'
import { auth, devicePersistence } from '@shared/firebase/config'
import { getAuthErrorMessage } from '@shared/firebase/authErrors'
import AppText from '../../components/AppText'
import Button from '../../components/Button'
import Checkbox from '../../components/Checkbox'
import { ENTRANCE_SPRING, useEntrance } from '../../components/Entrance'
import Notice from '../../components/Notice'
import BrandHero from '../../components/BrandHero'
import SegmentedControl from '../../components/SegmentedControl'
import TextField from '../../components/TextField'
import { useSignInGate } from '../../auth/SignInGate'
import SignUpForm from '../../auth/SignUpForm'
import VerifyEmailCard, { type PendingVerification } from '../../auth/VerifyEmailCard'
import { useLang } from '../../i18n/LangProvider'
import { API_BASE_URL } from '../../lib/env'
import { VIEWPORT_HEIGHT, webOnly } from '../../lib/webStyles'
import { colors } from '../../theme'

// Password reset and business login stay on the website for now.
const openWeb = (path: string) => Linking.openURL(`${API_BASE_URL}${path}`)


type Mode = 'signIn' | 'signUp'

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
// The card rises this far as the splash logo settles into the hero spot.
const CARD_RISE = 40

export default function LoginScreen() {
  const { t, appLang, setLang } = useLang()
  const { setChecking } = useSignInGate()
  const { phase, setHeroRect } = useEntrance()
  const reduced = useReducedMotion()
  const heroRef = useRef<View>(null)
  // Arriving after launch (e.g. after signing out) there's no entrance to play.
  const entering = useRef(phase !== 'done').current
  const cardY = useSharedValue(entering && !reduced ? CARD_RISE : 0)
  const cardOpacity = useSharedValue(entering ? 0 : 1)
  const [mode, setMode] = useState<Mode>('signIn')
  const [rememberMe, setRememberMe] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [businessAccount, setBusinessAccount] = useState(false)
  const [pending, setPending] = useState<PendingVerification | null>(null)

  const handleSubmit = async () => {
    setError(null)
    setBusinessAccount(false)
    setSubmitting(true)
    setChecking(true)
    try {
      // Same contract as the web login: unchecked keeps the session in memory
      // only, so it ends when the app is closed.
      await setPersistence(auth, rememberMe ? devicePersistence : inMemoryPersistence)
      // The real app language, not this screen's forced English: the account's
      // saved preference is applied to the app only if it differs from it.
      const result = await signInCustomerWithEmail(email.trim(), password, appLang)
      if (result.status === 'businessAccount') {
        setBusinessAccount(true)
        setSubmitting(false)
      } else if (result.status === 'unverified') {
        setPending({ variant: 'login', email: result.email, idToken: result.idToken })
        setSubmitting(false)
      } else if (result.preferredLanguage) {
        setLang(result.preferredLanguage)
      }
      // On success the root layout swaps this screen for the tabs once the gate opens.
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setSubmitting(false)
    } finally {
      setChecking(false)
    }
  }

  // The card and top bar rise in while the splash logo glides into the hero.
  useEffect(() => {
    if (!entering || phase !== 'settling') return
    cardY.set(withDelay(60, withSpring(0, ENTRANCE_SPRING)))
    cardOpacity.set(withDelay(60, withTiming(1, { duration: 420, easing: EASE_OUT })))
  }, [entering, phase, cardY, cardOpacity])

  const riseStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.get(),
    transform: [{ translateY: cardY.get() }],
  }))
  const fadeStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.get() }))

  // Tell the splash where the hero sits so its logo can land exactly on it.
  const reportHero = () => {
    if (phase === 'done') return
    heroRef.current?.measureInWindow((x, y, width, height) => setHeroRect({ x, y, width, height }))
  }

  // Back from "check your inbox": land on Sign In with the email filled in.
  const handleBackToSignIn = () => {
    if (pending) setEmail(pending.email)
    setPassword('')
    setPending(null)
    setMode('signIn')
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.main}>
            {/* Hidden until the splash hands over: its logo is landing on this exact spot. */}
            <View
              ref={heroRef}
              collapsable={false}
              onLayout={reportHero}
              style={[styles.header, phase !== 'done' && styles.hidden]}
            >
              <BrandHero />
            </View>

            <Animated.View style={[styles.card, riseStyle]}>
              {pending ? (
                <VerifyEmailCard pending={pending} onBack={handleBackToSignIn} />
              ) : (
                <>
                  <SegmentedControl
                    options={[
                      { value: 'signIn', label: t('login_title') },
                      { value: 'signUp', label: t('signup_title') },
                    ]}
                    value={mode}
                    onChange={setMode}
                    style={styles.modeSwitch}
                  />

                  {mode === 'signIn' ? (
                    <>
                      {error && <Notice message={error} />}
                      {businessAccount && (
                        <View style={styles.businessNotice}>
                          <Notice message={t('login_businessAccountError')} />
                          <Pressable accessibilityRole="link" onPress={() => openWeb('/business/login')} hitSlop={8} style={styles.pointer}>
                            <AppText style={[styles.link, styles.center]}>{t('login_businessAccountLink')}</AppText>
                          </Pressable>
                        </View>
                      )}

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
                          onPress={() => openWeb('/forgot-password')}
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
                        disabled={!email || !password}
                        large
                        arrow
                      />
                    </>
                  ) : (
                    <SignUpForm onPendingVerification={setPending} />
                  )}
                </>
              )}
            </Animated.View>

            {!pending && (
              <Animated.View style={[styles.footer, fadeStyle]}>
                <AppText style={styles.muted}>{t(mode === 'signIn' ? 'login_noAccount' : 'signup_haveAccount')}</AppText>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
                  hitSlop={12}
                  style={styles.pointer}
                >
                  <AppText style={styles.link}>{t(mode === 'signIn' ? 'login_signupLink' : 'signup_loginLink')}</AppText>
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
  safe: { flex: 1, backgroundColor: colors.background, direction: 'ltr' },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    // Web: fill the browser viewport and center the column in it.
    ...webOnly({ minHeight: VIEWPORT_HEIGHT, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 }),
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 16,
    // Web: one fixed-width column instead of stretching across the viewport.
    ...webOnly({ width: '100%', maxWidth: 440, alignSelf: 'center', marginHorizontal: 'auto' }),
  },
  header: { alignSelf: 'center', marginBottom: 24, ...webOnly({ marginBottom: 28 }) },
  hidden: { opacity: 0 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    // Layered: a hairline contact shadow, a soft mid shadow and a wide ambient
    // one. boxShadow renders natively on the New Architecture and on web alike.
    boxShadow:
      '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 20px -4px rgba(15, 23, 42, 0.06), 0 28px 56px -16px rgba(15, 23, 42, 0.14)',
    ...webOnly({ width: '100%', maxWidth: 440, alignSelf: 'center', marginHorizontal: 'auto', padding: 32 }),
  },
  modeSwitch: { marginBottom: 24 },
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
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 24 },
})
