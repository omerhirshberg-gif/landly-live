import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, { Easing, FadeInLeft, FadeInRight } from 'react-native-reanimated'
import type { CountryCode } from 'libphonenumber-js'
import { DEFAULT_COUNTRY, nextStep, phoneToE164, prevStep, type OnboardingStep } from '@shared/auth/onboarding'
import { auth } from '@shared/firebase/config'
import { getAuthErrorMessage } from '@shared/firebase/authErrors'
import { completeOnboardingProfile } from '@shared/firebase/users'
import type { TranslationKey } from '@shared/i18n/translations'
import Button from '../../components/Button'
import Notice from '../../components/Notice'
import TextField from '../../components/TextField'
import { useLang } from '../../i18n/LangProvider'
import { requestNotificationPermission } from '../../lib/notificationPermission'
import { useKeyboardVisible } from '../../lib/useKeyboardVisible'
import CountryCodePicker from './CountryCodePicker'
import LanguageStep from './LanguageStep'
import NotificationsStep from './NotificationsStep'
import PersonaStep from './PersonaStep'
import StepHeader from './StepHeader'
import StepIntro from './StepIntro'

interface WizardData {
  customerType: string
  country: CountryCode
  phone: string
}

type FieldErrors = Partial<Record<'customerType' | 'phone', string>>

const TITLES: Record<OnboardingStep, { title: TranslationKey; subtitle: TranslationKey }> = {
  language: { title: 'onb_lang_title', subtitle: 'onb_lang_subtitle' },
  persona: { title: 'onb_persona_title', subtitle: 'onb_persona_subtitle' },
  phone: { title: 'onb_phone_title', subtitle: 'onb_phone_subtitle' },
  notifications: { title: 'onb_notif_title', subtitle: 'onb_notif_subtitle' },
}

// A tap on a language card moves on after this long, so the selection reads first.
const AUTO_ADVANCE_MS = 250
// Below this window height the subtitles go, as they do whenever the keyboard is up.
const SHORT_SCREEN = 700
const STEP_EASE = Easing.bezier(0.23, 1, 0.32, 1)

// Post-sign-in onboarding (native counterpart of components/auth/onboarding/
// OnboardingWizard.tsx): language, persona, WhatsApp number and
// notifications, one card at a time. It only runs for a signed-in, verified
// member whose profile is incomplete — the sign-in gate stays closed
// (`onboarding`) until it finishes — so the answers are saved with a single
// update at the end. Step order: lib/auth/onboarding.ts.
export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { t, lang, isRtl } = useLang()
  const keyboardVisible = useKeyboardVisible()
  const { height } = useWindowDimensions()
  const compact = keyboardVisible || height < SHORT_SCREEN
  const [step, setStep] = useState<OnboardingStep>('language')
  const [direction, setDirection] = useState<1 | -1>(1)
  const [data, setData] = useState<WizardData>({ customerType: '', country: DEFAULT_COUNTRY, phone: '' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'enable' | 'later' | null>(null)
  const [navigated, setNavigated] = useState(false)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(advanceTimer.current), [])

  const set = <K extends keyof WizardData>(key: K, value: WizardData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }))
    // A new country can make the typed number valid, so it clears the phone error too.
    const errorKey = key === 'country' ? 'phone' : key
    setFieldErrors((prev) => (prev[errorKey as keyof FieldErrors] ? { ...prev, [errorKey]: undefined } : prev))
  }

  const goTo = (target: OnboardingStep, dir: 1 | -1) => {
    clearTimeout(advanceTimer.current)
    setNavigated(true)
    setDirection(dir)
    setError(null)
    setStep(target)
  }

  const back = prevStep(step)
  const goBack = back && !busy ? () => goTo(back, -1) : null

  const advance = (from: OnboardingStep = step) => {
    const target = nextStep(from)
    if (target) goTo(target, 1)
  }

  // Each step's own check before moving on; false keeps the user on it.
  const validate = (): boolean => {
    const errors: FieldErrors = {}
    if (step === 'persona' && !data.customerType) errors.customerType = t('mobile_signup_typeRequired')
    if (step === 'phone' && !phoneToE164(data.country, data.phone)) errors.phone = t('phone_invalid_error')
    setFieldErrors(errors)
    return !Object.values(errors).some(Boolean)
  }

  const handleContinue = () => {
    if (validate()) advance()
  }

  const finish = async (notificationsOptIn: boolean) => {
    const e164 = phoneToE164(data.country, data.phone)
    if (!e164) {
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
      await completeOnboardingProfile(user.uid, { phone: e164, customerType: data.customerType, preferredLanguage: lang, notificationsOptIn })
      onComplete()
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

  // Forward steps come in from the reading direction's far side; back, from the near side.
  const fromRight = (direction === 1) !== isRtl
  const entering = navigated ? (fromRight ? FadeInRight : FadeInLeft).duration(220).easing(STEP_EASE) : undefined
  const { title, subtitle } = TITLES[step]

  return (
    <View>
      <StepHeader step={step} onBack={goBack} />

      <Animated.View key={step} entering={entering}>
        <StepIntro title={t(title)} subtitle={t(subtitle)} compact={compact && step !== 'language'} />

        {error && <Notice message={error} />}

        {step === 'language' && (
          <LanguageStep
            onPick={() => {
              clearTimeout(advanceTimer.current)
              advanceTimer.current = setTimeout(() => advance('language'), AUTO_ADVANCE_MS)
            }}
          />
        )}

        {step === 'persona' && <PersonaStep value={data.customerType} onChange={(v) => set('customerType', v)} error={fieldErrors.customerType} />}

        {step === 'phone' && (
          <TextField
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
          />
        )}

        {step === 'notifications' ? (
          <NotificationsStep busy={busy} onEnable={handleEnable} onLater={handleLater} />
        ) : (
          <View style={styles.cta}>
            <Button label={t('onb_continue')} onPress={handleContinue} large arrow />
          </View>
        )}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  cta: { marginTop: 4 },
})
