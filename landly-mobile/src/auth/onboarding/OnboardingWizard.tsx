import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated from 'react-native-reanimated'
import { DEFAULT_COUNTRY, nextStep, personaNote, phoneToE164, prevStep, type OnboardingDraft, type OnboardingStep } from '@shared/auth/onboarding'
import { WELCOME_POINTS } from '@shared/brand/onboardingIcons'
import { ONB } from '@shared/brand/onboardingMotion'
import { auth } from '@shared/firebase/config'
import { getAuthErrorMessage } from '@shared/firebase/authErrors'
import { completeOnboardingProfile } from '@shared/firebase/users'
import { useAuth } from '@shared/firebase/useAuth'
import type { Lang, TranslationKey } from '@shared/i18n/translations'
import AppText from '../../components/AppText'
import Button from '../../components/Button'
import CountryOfOriginList from '../../components/CountryOfOriginList'
import Notice from '../../components/Notice'
import TextField from '../../components/TextField'
import { useLang } from '../../i18n/LangProvider'
import { requestNotificationPermission } from '../../lib/notificationPermission'
import { useKeyboardVisible } from '../../lib/useKeyboardVisible'
import { isWeb, webOnly } from '../../lib/webStyles'
import { colors } from '../../theme'
import CelebrationBadge from './CelebrationBadge'
import CountryCodePicker from './CountryCodePicker'
import { saveOnboardingDraft } from './draftStorage'
import LanguageStep from './LanguageStep'
import NotificationsActions, { NotificationPoints } from './NotificationsStep'
import PersonaStep from './PersonaStep'
import PointList from './PointList'
import StepHeader from './StepHeader'
import StepIntro from './StepIntro'
import { FADE_CSS, rise, SILK_CSS, stepEntering, stepExiting } from './motion'

type WizardData = Omit<OnboardingDraft, 'step'>

const EMPTY_DATA: WizardData = { customerType: '', customerTypeOther: '', countryOfOrigin: '', country: DEFAULT_COUNTRY, phone: '', phoneSkipped: false }

type FieldErrors = Partial<Record<'customerType' | 'countryOfOrigin' | 'phone', string>>

const TITLES: Partial<Record<OnboardingStep, { title: TranslationKey; subtitle: TranslationKey }>> = {
  language: { title: 'onb_lang_title', subtitle: 'onb_lang_subtitle' },
  persona: { title: 'onb_persona_title', subtitle: 'onb_persona_subtitle' },
  origin: { title: 'onb_origin_title', subtitle: 'onb_origin_subtitle' },
  phone: { title: 'onb_phone_title', subtitle: 'onb_phone_subtitle' },
  notifications: { title: 'onb_notif_title', subtitle: 'onb_notif_subtitle' },
}

// Below this window height the subtitles go, as they do whenever the keyboard is up.
const SHORT_SCREEN = 700
// The stage reaches out over the card's padding (login.tsx: 20, 32 on web), so
// the clip that hides the drifting cards never cuts a focus ring or a scaled field.
const STAGE_PAD_X = isWeb ? 32 : 20
const STAGE_PAD_Y = 12

// Post-sign-in onboarding (native counterpart of components/auth/onboarding/
// OnboardingWizard.tsx): welcome, language, persona, country of origin,
// WhatsApp number, notifications and a celebration, one card at a time. It only runs for a
// signed-in, verified member who hasn't finished it — the sign-in gate stays
// closed (`onboarding`) until "Let's explore" — so the answers are saved with
// a single update when the notifications card is left. Step order:
// lib/auth/onboarding.ts; motion: lib/brand/onboardingMotion.ts. The card on
// screen and the answers so far are kept on the device (`draft` is what was
// there when the wizard opened), so an app restart resumes the same card.
//
// A card change is a Reanimated hand-over: the old card fades out drifting
// away (exiting) while the new one fades in from the other side (entering),
// its sections rising in one after another. The current card stays in normal
// flow, so the stage is simply as tall as it is: nothing is measured, so
// nothing can pin the stage shut. The leaving card overlaps it on its own —
// native keeps its last frame, and on web Reanimated pins its clone
// absolutely where it was.
export default function OnboardingWizard({
  uid,
  name,
  draft,
  onComplete,
}: {
  uid: string
  name: string | null
  draft: OnboardingDraft | null
  onComplete: () => void
}) {
  const { t, lang, setLang, isRtl } = useLang()
  const { setOnboardingComplete } = useAuth()
  const keyboardVisible = useKeyboardVisible()
  const { height } = useWindowDimensions()
  const compact = keyboardVisible || height < SHORT_SCREEN
  const [step, setStep] = useState<OnboardingStep>(draft?.step ?? 'welcome')
  // Set first, so the current card re-renders with the right `exiting` before
  // the step changes (an unmounting view keeps the props of its last render).
  const [nav, setNav] = useState<{ target: OnboardingStep; dir: 1 | -1 } | null>(null)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [data, setData] = useState<WizardData>(() =>
    draft
      ? {
          customerType: draft.customerType,
          customerTypeOther: draft.customerTypeOther,
          countryOfOrigin: draft.countryOfOrigin,
          country: draft.country,
          phone: draft.phone,
          phoneSkipped: draft.phoneSkipped,
        }
      : EMPTY_DATA
  )
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'enable' | 'later' | 'explore' | null>(null)
  const [pendingLang, setPendingLang] = useState<Lang | null>(null)
  const [fading, setFading] = useState(false)
  const pendingLangRef = useRef<Lang | null>(null)
  const langTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(langTimer.current), [])

  // Progress is kept as it's made; the celebration only follows a save, which clears it.
  useEffect(() => {
    if (step !== 'done') saveOnboardingDraft(uid, { step, ...data })
  }, [uid, step, data])

  useEffect(() => {
    if (!nav) return
    setError(null)
    setStep(nav.target)
    setNav(null)
  }, [nav])

  const set = <K extends keyof WizardData>(key: K, value: WizardData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }))
    // A new country can make the typed number valid, so it clears the phone error too.
    const errorKey = key === 'country' ? 'phone' : key
    setFieldErrors((prev) => (prev[errorKey as keyof FieldErrors] ? { ...prev, [errorKey]: undefined } : prev))
  }

  const goTo = (target: OnboardingStep, dir: 1 | -1) => {
    setDirection(dir)
    setNav({ target, dir })
  }

  const back = prevStep(step)
  const goBack = back && !busy ? () => goTo(back, -1) : null

  const advance = () => {
    const target = nextStep(step)
    if (target) goTo(target, 1)
  }

  // Picking a language: the row shows as chosen at once, the wizard fades
  // out, the locale and direction flip while it's invisible, and it fades
  // back in. Picks made during the fade apply the latest at its end.
  const chooseLanguage = (code: Lang) => {
    if (code === (pendingLangRef.current ?? lang)) return
    pendingLangRef.current = code
    setPendingLang(code)
    if (langTimer.current !== undefined) return
    setFading(true)
    langTimer.current = setTimeout(() => {
      langTimer.current = undefined
      const next = pendingLangRef.current
      pendingLangRef.current = null
      setPendingLang(null)
      if (next && next !== lang) setLang(next)
      setFading(false)
    }, ONB.langOutMs)
  }

  // Each step's own check before moving on; false keeps the user on it.
  const validate = (): boolean => {
    const errors: FieldErrors = {}
    if (step === 'persona' && !data.customerType) errors.customerType = t('mobile_signup_typeRequired')
    if (step === 'origin' && !data.countryOfOrigin) errors.countryOfOrigin = t('onb_originRequired')
    if (step === 'phone' && !phoneToE164(data.country, data.phone)) errors.phone = t('phone_invalid_error')
    setFieldErrors(errors)
    return !Object.values(errors).some(Boolean)
  }

  const handleContinue = () => {
    if (!validate()) return
    if (step === 'phone') set('phoneSkipped', false)
    advance()
  }

  const handleSkipPhone = () => {
    setFieldErrors((prev) => ({ ...prev, phone: undefined }))
    set('phoneSkipped', true)
    advance()
  }

  const finish = async (notificationsOptIn: boolean) => {
    const e164 = data.phoneSkipped ? '' : phoneToE164(data.country, data.phone)
    if (e164 === null) {
      setBusy(null)
      goTo('phone', -1)
      return
    }
    const user = auth.currentUser
    if (!user) {
      setError(getAuthErrorMessage(null))
      setBusy(null)
      return
    }
    setError(null)
    try {
      await completeOnboardingProfile(user.uid, {
        phone: e164,
        customerType: data.customerType,
        customerTypeOther: personaNote(data.customerType, data.customerTypeOther),
        countryOfOrigin: data.countryOfOrigin,
        preferredLanguage: lang,
        notificationsOptIn,
      })
      saveOnboardingDraft(uid, null)
      // The sign-in gate (`onboarding`) still holds the tabs back until "Let's explore".
      setOnboardingComplete(true)
      setBusy(null)
      goTo('done', 1)
    } catch (err) {
      setError(getAuthErrorMessage(err))
      setBusy(null)
    }
  }

  const handleEnable = async () => {
    setBusy('enable')
    await finish(await requestNotificationPermission())
  }

  const handleLater = async () => {
    setBusy('later')
    await finish(false)
  }

  const handleExplore = () => {
    setBusy('explore')
    onComplete()
  }

  const continueButton = <Button label={t('onb_continue')} onPress={handleContinue} large arrow />

  // Each card as its sections (title, body, actions), which rise in one after another.
  const sections = (): ReactNode[] => {
    if (step === 'welcome') {
      return [
        <StepIntro
          key="intro"
          title={name ? t('onb_welcome_title').replace('{name}', name) : t('onb_welcome_title_generic')}
          subtitle={t('onb_welcome_subtitle')}
          compact={compact}
        />,
        <PointList key="body" points={WELCOME_POINTS.map((p) => ({ icon: p.icon, label: t(p.key) }))} />,
        <Button key="actions" label={t('onb_getStarted')} onPress={advance} large arrow />,
      ]
    }
    if (step === 'done') {
      return [
        <CelebrationBadge key="badge" />,
        <View key="copy">
          <AppText accessibilityRole="header" style={styles.doneTitle}>
            {name ? t('onb_done_title').replace('{name}', name) : t('onb_done_title_generic')}
          </AppText>
          <AppText style={styles.doneBody}>{t('onb_done_body')}</AppText>
        </View>,
        <Button key="actions" label={t('onb_done_cta')} onPress={handleExplore} busy={busy === 'explore'} large />,
      ]
    }
    const { title, subtitle } = TITLES[step]!
    const intro = (
      <View key="intro">
        <StepIntro title={t(title)} subtitle={t(subtitle)} compact={compact && step !== 'language'} />
        {error && <Notice message={error} />}
      </View>
    )
    if (step === 'language') {
      return [intro, <LanguageStep key="body" selected={pendingLang ?? lang} onSelect={chooseLanguage} />, <View key="actions">{continueButton}</View>]
    }
    if (step === 'persona') {
      return [
        intro,
        <PersonaStep
          key="body"
          value={data.customerType}
          onChange={(v) => set('customerType', v)}
          note={data.customerTypeOther}
          onNoteChange={(v) => set('customerTypeOther', v)}
          onSubmit={handleContinue}
          error={fieldErrors.customerType}
        />,
        <View key="actions">{continueButton}</View>,
      ]
    }
    if (step === 'origin') {
      return [
        intro,
        <CountryOfOriginList
          key="body"
          value={data.countryOfOrigin}
          onChange={(code) => set('countryOfOrigin', code)}
          error={fieldErrors.countryOfOrigin}
        />,
        <View key="actions">{continueButton}</View>,
      ]
    }
    if (step === 'phone') {
      return [
        intro,
        <TextField
          key="body"
          label={t('onb_phoneLabel')}
          prefix={<CountryCodePicker value={data.country} onChange={(c) => set('country', c)} />}
          value={data.phone}
          onChangeText={(v) => set('phone', v)}
          error={fieldErrors.phone}
          placeholder={data.country === 'IL' ? '50 123 4567' : undefined}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="next"
          onSubmitEditing={handleContinue}
        />,
        <View key="actions" style={styles.actions}>
          {continueButton}
          <Pressable accessibilityRole="button" onPress={handleSkipPhone} hitSlop={8} style={styles.skip}>
            {({ pressed }) => <AppText style={[styles.skipText, pressed && styles.skipPressed]}>{t('onb_phone_skip')}</AppText>}
          </Pressable>
        </View>,
      ]
    }
    return [
      intro,
      <NotificationPoints key="body" />,
      <NotificationsActions key="actions" busy={busy === 'enable' || busy === 'later' ? busy : null} onEnable={handleEnable} onLater={handleLater} />,
    ]
  }

  // Forward: the new card comes in from the reading direction's far side and
  // the old one leaves toward the near side; back reverses both.
  const forwardInReadingDirection = (direction === 1) !== isRtl
  const fade = {
    opacity: fading ? 0 : 1,
    transitionProperty: 'opacity',
    transitionDuration: fading ? ONB.langOutMs : ONB.langInMs,
    transitionTimingFunction: fading ? FADE_CSS : SILK_CSS,
  } as const

  return (
    <Animated.View style={fade}>
      <StepHeader step={step} onBack={goBack} />

      <View style={styles.stage}>
        <Animated.View
          key={step}
          entering={stepEntering(forwardInReadingDirection)}
          exiting={stepExiting(forwardInReadingDirection)}
        >
          {sections().map((node, i) => (
            <Animated.View key={i} entering={rise(i, step === 'done' && i > 0 ? ONB.celebrateCopyDelayMs : 0)}>
              {node}
            </Animated.View>
          ))}
        </Animated.View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Only the sideways drift is clipped: on web just the x axis, so a taller
  // leaving card fades out whole; native clips both (it has no overflow-x).
  stage: {
    overflow: 'hidden',
    marginHorizontal: -STAGE_PAD_X,
    marginVertical: -STAGE_PAD_Y,
    paddingHorizontal: STAGE_PAD_X,
    paddingVertical: STAGE_PAD_Y,
    ...webOnly({ overflowX: 'clip', overflowY: 'visible' }),
  },
  // At least 20px between Continue and "Skip for now", so the skip never reads as part of the CTA.
  actions: { gap: 20 },
  skip: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 12, ...webOnly({ cursor: 'pointer' }) },
  skipText: { fontSize: 14, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
  skipPressed: { color: colors.brand },
  doneTitle: { fontSize: 24, lineHeight: 32, fontWeight: '800', color: colors.textStrong, textAlign: 'center' },
  doneBody: { marginTop: 8, marginBottom: 28, fontSize: 15, lineHeight: 24, color: colors.textMuted, textAlign: 'center' },
})
