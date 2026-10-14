'use client'

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import type { CountryCode } from 'libphonenumber-js'
import { auth } from '@/lib/firebase/config'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { completeOnboardingProfile } from '@/lib/firebase/users'
import { DEFAULT_COUNTRY, nextStep, phoneToE164, prevStep, type OnboardingStep } from '@/lib/auth/onboarding'
import type { TranslationKey } from '@/lib/i18n/translations'
import { useLang } from '@/lib/i18n/useLang'
import Button from '../entrance/Button'
import Notice from '../entrance/Notice'
import TextField from '../entrance/TextField'
import styles from '../entrance/entrance.module.css'
import CountryCodeSelect from './CountryCodeSelect'
import LanguageStep from './LanguageStep'
import NotificationsStep from './NotificationsStep'
import PersonaStep from './PersonaStep'
import StepHeader from './StepHeader'
import StepIntro from './StepIntro'
import { requestNotificationPermission } from './notificationPermission'

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
// How far a step slides in from (towards the reading direction when going forward).
const STEP_SLIDE_PX = 16

// Post-sign-in onboarding (web counterpart of landly-mobile/src/auth/
// onboarding/OnboardingWizard.tsx): language, persona, WhatsApp number and
// notifications, one card at a time. It only ever runs for a signed-in,
// verified member whose profile is incomplete, so the answers are saved with
// a single update at the end. All answers live in one state object so ←
// never loses anything. Step order: lib/auth/onboarding.ts.
export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { t, lang, isRtl } = useLang()
  const titleId = useId()
  const [step, setStep] = useState<OnboardingStep>('language')
  const [direction, setDirection] = useState<1 | -1>(1)
  const [data, setData] = useState<WizardData>({ customerType: '', country: DEFAULT_COUNTRY, phone: '' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'enable' | 'later' | null>(null)
  const navigated = useRef(false)
  const stepRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const advanceTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(advanceTimer.current), [])

  // After a step change, focus its first field where there's a real pointer
  // and keyboard; on touch screens focus the title instead, so the keyboard
  // doesn't pop up uninvited but screen readers still announce the new step.
  useEffect(() => {
    if (!navigated.current) return
    const field = stepRef.current?.querySelector<HTMLElement>('input, [role="radio"][tabindex="0"]')
    if (field && window.matchMedia('(hover: hover) and (pointer: fine)').matches) field.focus()
    else titleRef.current?.focus()
  }, [step])

  const set = <K extends keyof WizardData>(key: K, value: WizardData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }))
    // A new country can make the typed number valid, so it clears the phone error too.
    const errorKey = key === 'country' ? 'phone' : key
    setFieldErrors((prev) => (prev[errorKey as keyof FieldErrors] ? { ...prev, [errorKey]: undefined } : prev))
  }

  const goTo = (target: OnboardingStep, dir: 1 | -1) => {
    window.clearTimeout(advanceTimer.current)
    navigated.current = true
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

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()
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

  const slide: CSSProperties = { ['--step-from' as string]: `${direction * (isRtl ? -1 : 1) * STEP_SLIDE_PX}px` }
  const { title, subtitle } = TITLES[step]

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === 'Escape' && goBack && !(e.target instanceof HTMLSelectElement)) goBack()
      }}
    >
      <StepHeader step={step} onBack={goBack} />

      <div key={step} ref={stepRef} className={navigated.current ? styles.step : undefined} style={slide}>
        <StepIntro id={titleId} title={t(title)} subtitle={t(subtitle)} titleRef={titleRef} />

        {error && <Notice>{error}</Notice>}

        {step === 'notifications' ? (
          <NotificationsStep busy={busy} onEnable={handleEnable} onLater={handleLater} />
        ) : (
          <form noValidate onSubmit={handleContinue}>
            {step === 'language' && (
              <LanguageStep
                labelledBy={titleId}
                onPick={() => {
                  window.clearTimeout(advanceTimer.current)
                  advanceTimer.current = window.setTimeout(() => advance('language'), AUTO_ADVANCE_MS)
                }}
              />
            )}

            {step === 'persona' && (
              <PersonaStep labelledBy={titleId} value={data.customerType} onChange={(v) => set('customerType', v)} error={fieldErrors.customerType} />
            )}

            {step === 'phone' && (
              <TextField
                label={t('onb_phoneLabel')}
                type="tel"
                prefix={<CountryCodeSelect value={data.country} onChange={(c) => set('country', c)} />}
                value={data.phone}
                onChange={(e) => set('phone', e.target.value)}
                error={fieldErrors.phone}
                placeholder={data.country === 'IL' ? '50 123 4567' : undefined}
                inputMode="tel"
                autoComplete="tel-national"
                enterKeyHint="next"
              />
            )}

            <div className="mt-1">
              <Button type="submit" label={t('onb_continue')} large arrow />
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
