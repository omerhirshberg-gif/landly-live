'use client'

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { auth } from '@/lib/firebase/config'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { completeOnboardingProfile } from '@/lib/firebase/users'
import { useAuth } from '@/lib/firebase/useAuth'
import {
  DEFAULT_COUNTRY,
  nextStep,
  onboardingDraftKey,
  personaNote,
  phoneToE164,
  prevStep,
  serializeOnboardingDraft,
  type OnboardingDraft,
  type OnboardingStep,
} from '@/lib/auth/onboarding'
import { ONB } from '@/lib/brand/onboardingMotion'
import type { Lang, TranslationKey } from '@/lib/i18n/translations'
import { useLang } from '@/lib/i18n/useLang'
import Button from '../entrance/Button'
import Notice from '../entrance/Notice'
import TextField from '../entrance/TextField'
import styles from '../entrance/entrance.module.css'
import CountryOfOriginPicker from '@/components/profile/CountryOfOriginPicker'
import CelebrationStep from './CelebrationStep'
import CountryCodeSelect from './CountryCodeSelect'
import LanguageStep from './LanguageStep'
import NotificationsStep from './NotificationsStep'
import PersonaStep from './PersonaStep'
import StepHeader from './StepHeader'
import StepIntro from './StepIntro'
import WelcomeStep from './WelcomeStep'
import { requestNotificationPermission } from './notificationPermission'
import { ONBOARDING_VARS } from './onboardingVars'

type WizardData = Omit<OnboardingDraft, 'step'>

const EMPTY_DATA: WizardData = { customerType: '', customerTypeOther: '', countryOfOrigin: '', country: DEFAULT_COUNTRY, phone: '', phoneSkipped: false }

function saveDraft(uid: string, draft: OnboardingDraft | null) {
  try {
    if (draft) localStorage.setItem(onboardingDraftKey(uid), serializeOnboardingDraft(draft))
    else localStorage.removeItem(onboardingDraftKey(uid))
  } catch {
    // Storage blocked — a reload just starts the cards over
  }
}

/** The member's saved progress on this browser (parseOnboardingDraft has the rules). */
export function readOnboardingDraft(uid: string): string | null {
  try {
    return localStorage.getItem(onboardingDraftKey(uid))
  } catch {
    return null
  }
}

type FieldErrors = Partial<Record<'customerType' | 'countryOfOrigin' | 'phone', string>>

const TITLES: Partial<Record<OnboardingStep, { title: TranslationKey; subtitle: TranslationKey }>> = {
  language: { title: 'onb_lang_title', subtitle: 'onb_lang_subtitle' },
  persona: { title: 'onb_persona_title', subtitle: 'onb_persona_subtitle' },
  origin: { title: 'onb_origin_title', subtitle: 'onb_origin_subtitle' },
  phone: { title: 'onb_phone_title', subtitle: 'onb_phone_subtitle' },
  notifications: { title: 'onb_notif_title', subtitle: 'onb_notif_subtitle' },
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Post-sign-in onboarding (web counterpart of landly-mobile/src/auth/
// onboarding/OnboardingWizard.tsx): welcome, language, persona, country of
// origin, WhatsApp number, notifications and a celebration, one card at a time. It only runs
// for a signed-in, verified member who hasn't finished it, so the answers are
// saved with a single update when the notifications card is left. All answers
// live in one state object so ← never loses anything. Step order:
// lib/auth/onboarding.ts; motion: lib/brand/onboardingMotion.ts.
//
// The card on screen and the answers so far are kept on this browser per
// member (`draft` is what was there at mount), so a reload resumes the same
// card; the draft goes once the answers are saved.
//
// A card change keeps the old card mounted (inert) for its fade-out while the
// new one fades in over it: both sit in the stage's one grid cell, so the
// stage is simply as tall as its content — nothing is measured, nothing can
// pin it shut — and only opacity and transform move.
export default function OnboardingWizard({
  uid,
  name,
  draft,
  onStepChange,
  onComplete,
}: {
  uid: string
  name: string | null
  draft: OnboardingDraft | null
  /** Each card as it comes up, for the desktop brand panel's step list. */
  onStepChange?: (step: OnboardingStep) => void
  onComplete: () => void
}) {
  const { t, lang, setLang, isRtl } = useLang()
  const { setOnboardingComplete } = useAuth()
  const baseId = useId()
  const [step, setStep] = useState<OnboardingStep>(draft?.step ?? 'welcome')
  const [leaving, setLeaving] = useState<{ step: OnboardingStep; dir: 1 | -1 } | null>(null)
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
  const navigated = useRef(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const stepEl = useRef<HTMLDivElement | null>(null)
  const leaveTimer = useRef<number | undefined>(undefined)
  const langTimer = useRef<number | undefined>(undefined)
  const pendingLangRef = useRef<Lang | null>(null)

  useEffect(
    () => () => {
      window.clearTimeout(leaveTimer.current)
      window.clearTimeout(langTimer.current)
    },
    []
  )

  // Progress is kept as it's made; the celebration only follows a save, which clears it.
  useEffect(() => {
    if (step !== 'done') saveDraft(uid, { step, ...data })
  }, [uid, step, data])

  useEffect(() => {
    onStepChange?.(step)
  }, [step, onStepChange])

  // After a step change, focus its first field where there's a real pointer
  // and keyboard; on touch screens focus the title instead, so the keyboard
  // doesn't pop up uninvited but screen readers still announce the new step.
  useEffect(() => {
    if (!navigated.current) return
    const field = stepEl.current?.querySelector<HTMLElement>('input, [role="radio"][tabindex="0"]')
    if (field && window.matchMedia('(hover: hover) and (pointer: fine)').matches) field.focus({ preventScroll: true })
    else titleRef.current?.focus({ preventScroll: true })
  }, [step])

  const set = <K extends keyof WizardData>(key: K, value: WizardData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }))
    // A new country can make the typed number valid, so it clears the phone error too.
    const errorKey = key === 'country' ? 'phone' : key
    setFieldErrors((prev) => (prev[errorKey as keyof FieldErrors] ? { ...prev, [errorKey]: undefined } : prev))
  }

  const goTo = (target: OnboardingStep, dir: 1 | -1) => {
    navigated.current = true
    setLeaving({ step, dir })
    window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => setLeaving(null), (reducedMotion() ? ONB.reducedMs : ONB.stepOutMs) + 40)
    setDirection(dir)
    setError(null)
    setStep(target)
  }

  const back = prevStep(step)
  const goBack = back && !busy ? () => goTo(back, -1) : null

  const advance = () => {
    const target = nextStep(step)
    if (target) goTo(target, 1)
  }

  // Picking a language: the row shows as chosen at once, the wizard fades
  // out, the locale and direction flip while it's invisible, and it fades
  // back in. Picks made during the fade (arrow keys) apply the latest at its end.
  const chooseLanguage = (code: Lang) => {
    if (code === (pendingLangRef.current ?? lang)) return
    pendingLangRef.current = code
    setPendingLang(code)
    if (langTimer.current !== undefined) return
    setFading(true)
    langTimer.current = window.setTimeout(() => {
      langTimer.current = undefined
      const next = pendingLangRef.current
      pendingLangRef.current = null
      setPendingLang(null)
      if (next && next !== lang) setLang(next)
      setFading(false)
    }, reducedMotion() ? ONB.reducedMs : ONB.langOutMs)
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

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()
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
      saveDraft(uid, null)
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

  const renderStep = (s: OnboardingStep, current: boolean): ReactNode => {
    const id = `${baseId}-${s}`
    const ref = current ? titleRef : undefined
    if (s === 'welcome') return <WelcomeStep id={id} name={name} titleRef={ref} onStart={advance} />
    if (s === 'done') return <CelebrationStep id={id} name={name} titleRef={ref} busy={busy === 'explore'} onExplore={handleExplore} />
    const { title, subtitle } = TITLES[s]!
    return (
      <>
        <StepIntro id={id} title={t(title)} subtitle={t(subtitle)} titleRef={ref} />

        {current && error ? <Notice>{error}</Notice> : null}

        {s === 'notifications' ? (
          <NotificationsStep busy={busy === 'enable' || busy === 'later' ? busy : null} onEnable={handleEnable} onLater={handleLater} />
        ) : (
          <form noValidate onSubmit={handleContinue}>
            {s === 'language' && <LanguageStep labelledBy={id} selected={pendingLang ?? lang} onSelect={chooseLanguage} />}

            {s === 'persona' && (
              <PersonaStep
                labelledBy={id}
                value={data.customerType}
                onChange={(v) => set('customerType', v)}
                note={data.customerTypeOther}
                onNoteChange={(v) => set('customerTypeOther', v)}
                error={fieldErrors.customerType}
              />
            )}

            {s === 'origin' && (
              <div className="mb-5">
                <CountryOfOriginPicker
                  value={data.countryOfOrigin}
                  onChange={(code) => set('countryOfOrigin', code)}
                  labelledBy={id}
                  invalid={!!fieldErrors.countryOfOrigin}
                  listClassName="max-h-[min(40dvh,320px)]"
                />
                {fieldErrors.countryOfOrigin && (
                  <p role="alert" className={`${styles.reveal} mt-2 text-xs font-semibold text-red-600`}>
                    {fieldErrors.countryOfOrigin}
                  </p>
                )}
              </div>
            )}

            {s === 'phone' && (
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

            {s === 'phone' && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={handleSkipPhone}
                  className="py-2.5 px-3 rounded-lg text-sm font-bold text-slate-500 cursor-pointer transition-colors duration-200 [@media(hover:hover)]:hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  {t('onb_phone_skip')}
                </button>
              </div>
            )}
          </form>
        )}
      </>
    )
  }

  // Forward: the new card comes in from the reading direction's far side and
  // the old one leaves toward the near side; back reverses both.
  const sign = (dir: 1 | -1) => dir * (isRtl ? -1 : 1)
  const inStyle = { ['--step-from' as string]: `${sign(direction) * ONB.driftPx}px` } as CSSProperties
  const outStyle = leaving ? ({ ['--step-to' as string]: `${-sign(leaving.dir) * ONB.driftPx}px` } as CSSProperties) : undefined

  return (
    <div
      className={styles.wizard}
      style={ONBOARDING_VARS}
      data-fading={fading ? '' : undefined}
      onKeyDown={(e) => {
        // Escape in a select, or in a country search with text (it clears it), isn't "back".
        const clearing = e.target instanceof HTMLInputElement && e.target.type === 'search' && !!e.target.value
        if (e.key === 'Escape' && goBack && !(e.target instanceof HTMLSelectElement) && !clearing) goBack()
      }}
    >
      <StepHeader step={step} onBack={goBack} />

      <div className={styles.stage}>
        {leaving && leaving.step !== step && (
          <div key={`out-${leaving.step}`} className={`${styles.step} ${styles.stepOut}`} style={outStyle} inert aria-hidden="true">
            {renderStep(leaving.step, false)}
          </div>
        )}
        <div key={step} ref={stepEl} className={`${styles.step} ${styles.stepIn} ${step === 'done' ? styles.celebrate : ''}`} style={inStyle}>
          {renderStep(step, true)}
        </div>
      </div>
    </div>
  )
}
