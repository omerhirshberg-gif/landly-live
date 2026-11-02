'use client'

import { useEffect, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from 'react'
import PhoneInput from 'react-phone-number-input'
import { AlertCircle, ArrowLeft, ArrowRight, ChevronDown, Loader2 } from 'lucide-react'
import { LANGUAGES } from '@/lib/i18n/languages'
import { isPrelaunchLang, PERSONAS, PRELAUNCH_COPY, REFERRAL_SOURCES, type Persona, type PrelaunchLang, type ReferralSource } from '@/lib/prelaunch/copy'
import type { JoinedLead } from '@/lib/prelaunch/share'
import type { ArrivalTelemetry } from '@/lib/prelaunch/telemetry'
import { leadFormErrors, MAX_NAME_LENGTH, MAX_PERSONA_OTHER_LENGTH, type LeadErrors, type LeadField, type LeadFormValues } from '@/lib/prelaunch/validation'

const EMPTY_VALUES: LeadFormValues = { firstName: '', lastName: '', phone: '', email: '', consent: false }
const FIELD_ORDER: LeadField[] = ['firstName', 'lastName', 'phone', 'email', 'consent']
const NAME_FIELDS = [
  { field: 'firstName', id: 'join-first-name', autoComplete: 'given-name', label: 'firstName', error: 'errName' },
  { field: 'lastName', id: 'join-last-name', autoComplete: 'family-name', label: 'lastName', error: 'errLastName' },
] as const
// A manual timer, not AbortSignal.timeout: iOS 15 lacks it. Retrying after a
// timeout is safe, because the server treats a repeat as the same lead.
const SUBMIT_TIMEOUT_MS = 15000
// Where olim's numbers most often come from, above the alphabetical list.
const COUNTRY_ORDER = ['IL', 'US', 'GB', 'FR', 'RU', 'UA', 'CA', 'AU', 'AR', 'BR', 'ZA', '|', '...'] as const

// One border colour or the other, never both: Tailwind's order, not this string's, would pick the winner.
// focus:outline-none, because the site's :focus-visible outline would otherwise sit around the ring.
const FIELD_CLASS = 'min-h-[48px] w-full rounded-xl border-[1.5px] bg-white px-4 py-3 text-base text-ink transition-shadow placeholder:text-slate-400 focus:outline-none focus:ring-4'
const VALID_CLASS = 'border-slate-200 focus:border-brand focus:ring-brand/10'
const INVALID_CLASS = 'border-red-400 focus:border-red-500 focus:ring-red-500/10'

// An emoji drawn from the country code. The picker's default loads every flag
// from an outside host, one more request on a slow in-app connection.
function CountryFlag({ country }: { country: string }) {
  const emoji = String.fromCodePoint(...Array.from(country, (letter) => 0x1f1e6 + letter.charCodeAt(0) - 65))
  return <span aria-hidden="true" className="text-xl leading-none">{emoji}</span>
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-red-600">
      <AlertCircle aria-hidden="true" size={16} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </p>
  )
}

// A native <select>, the picker in-app browsers handle best. `empty` is the
// unanswered state's look, on an optional question.
function SelectField({ id, name, label, value, empty, onChange, children }: {
  id: string
  name: string
  label: string
  value: string
  empty?: boolean
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
      <div className="relative">
        <select
          id={id}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${FIELD_CLASS} ${VALID_CLASS} cursor-pointer appearance-none pe-10 ${empty ? 'text-slate-500' : ''}`}
        >
          {children}
        </select>
        <ChevronDown aria-hidden="true" size={18} strokeWidth={1.75} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-slate-500" />
      </div>
    </>
  )
}

// The form: errors appear when a field is left, then clear as it's fixed, and a
// failed submit moves focus to the first field in need. A server failure keeps
// everything typed. The phone field stays left to right in both languages, on a
// <div> because <bdi> can't hold the block it renders. It starts empty every
// time, even over what the browser restored from an earlier visit, or the next
// person on a shared phone would find the last one's details.
export type CountryLabels = ComponentProps<typeof PhoneInput>['labels']

export default function LeadForm({
  lang,
  arrival,
  countryLabels,
  onJoined,
}: {
  lang: PrelaunchLang
  arrival: ArrivalTelemetry | null
  countryLabels?: CountryLabels
  onJoined: (lead: JoinedLead) => void
}) {
  const copy = PRELAUNCH_COPY[lang]
  const Arrow = lang === 'he' ? ArrowLeft : ArrowRight
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<LeadFormValues>(EMPTY_VALUES)
  const [errors, setErrors] = useState<LeadErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [persona, setPersona] = useState<Persona | ''>('')
  const [personaOther, setPersonaOther] = useState('')
  const [preferredLanguage, setPreferredLanguage] = useState<PrelaunchLang>(lang)
  const [referralSource, setReferralSource] = useState<ReferralSource | ''>('')
  const otherOpen = persona === 'other'

  useEffect(() => {
    const clear = () => {
      formRef.current?.reset()
      setValues(EMPTY_VALUES)
      setErrors({})
      setFormError(null)
      setPersona('')
      setPersonaOther('')
      setPreferredLanguage(lang)
      setReferralSource('')
    }
    clear()
    // The back-forward cache brings the page back as it was left.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) clear()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [lang])

  const choosePersona = (next: Persona | '') => {
    setPersona(next)
    if (next !== 'other') setPersonaOther('')
  }

  const change = (patch: Partial<LeadFormValues>, field: LeadField) => {
    const next = { ...values, ...patch }
    setValues(next)
    setFormError(null)
    // Only ever clears here: a half-typed field isn't wrong until it's left.
    if (errors[field] && !leadFormErrors(next)[field]) setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const checkField = (field: LeadField) => {
    // An empty field that was just passed through isn't a mistake yet.
    if (field !== 'consent' && !values[field]) return
    if (leadFormErrors(values)[field]) setErrors((current) => ({ ...current, [field]: true }))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const found = leadFormErrors(values)
    setErrors(found)
    const first = FIELD_ORDER.find((field) => found[field])
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus()
      return
    }

    setBusy(true)
    setFormError(null)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS)
    try {
      const website = new FormData(event.currentTarget).get('website')
      const response = await fetch('/api/prelaunch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, lang, preferredLanguage, persona: persona || null, personaOtherDescription: otherOpen ? personaOther : null, referralSource: referralSource || null, website, ref: arrival?.ref ?? undefined, attribution: arrival?.attribution }),
        signal: controller.signal,
      })
      const result = await response.json().catch(() => null)
      if (response.ok && typeof result?.referralCode === 'string') {
        onJoined({ referralCode: result.referralCode, firstName: values.firstName.trim() })
        return
      }
      setFormError(response.status === 429 ? copy.errRateLimited : copy.errGeneric)
    } catch {
      setFormError(copy.errGeneric)
    } finally {
      clearTimeout(timer)
      setBusy(false)
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate
      className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md sm:p-5"
    >
      {/* Honeypot: off-screen and out of the tab order, so only a bot fills it. */}
      <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {/* grid-cols-1, not an auto column: a <select> is as wide as its longest option. */}
      <div className="grid grid-cols-1 gap-3">
        {/* Side by side from 360px, which keeps the form short; a folded cover screen stacks them. */}
        <div className="grid items-start gap-3 min-[360px]:grid-cols-2">
          {NAME_FIELDS.map(({ field, id, autoComplete, label, error }) => (
            <div key={field} className="min-w-0">
              <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">{copy[label]}</label>
              <input
                id={id}
                data-field={field}
                type="text"
                name={field}
                autoComplete={autoComplete}
                enterKeyHint="next"
                maxLength={MAX_NAME_LENGTH}
                required
                aria-invalid={errors[field] ? true : undefined}
                aria-describedby={errors[field] ? `${id}-error` : undefined}
                value={values[field]}
                onChange={(event) => change({ [field]: event.target.value }, field)}
                onBlur={() => checkField(field)}
                className={`${FIELD_CLASS} ${errors[field] ? INVALID_CLASS : VALID_CLASS}`}
              />
              {errors[field] && <FieldError id={`${id}-error`} message={copy[error]} />}
            </div>
          ))}
        </div>

        <div>
          <label htmlFor="join-phone" className="mb-1.5 block text-sm font-semibold text-ink">{copy.phone}</label>
          <div dir="ltr" className={`join-phone rounded-xl transition-shadow focus-within:ring-4 ${errors.phone ? 'join-phone-invalid focus-within:ring-red-500/10' : 'focus-within:ring-brand/10'}`}>
            <PhoneInput
              id="join-phone"
              data-field="phone"
              international
              countryCallingCodeEditable={false}
              defaultCountry="IL"
              addInternationalOption={false}
              countryOptionsOrder={[...COUNTRY_ORDER]}
              labels={countryLabels}
              locales={lang}
              flagComponent={CountryFlag}
              countrySelectProps={{ 'aria-label': copy.countrySelect }}
              autoComplete="tel"
              enterKeyHint="next"
              required
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? 'join-phone-error' : undefined}
              value={values.phone}
              onChange={(value) => change({ phone: value ?? '' }, 'phone')}
              onBlur={() => checkField('phone')}
            />
          </div>
          {errors.phone && <FieldError id="join-phone-error" message={copy.errPhone} />}
        </div>

        <div>
          <label htmlFor="join-email" className="mb-1.5 block text-sm font-semibold text-ink">{copy.email}</label>
          <input
            id="join-email"
            data-field="email"
            type="email"
            name="email"
            dir="ltr"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            enterKeyHint="done"
            maxLength={254}
            required
            placeholder={copy.emailPlaceholder}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'join-email-error' : undefined}
            value={values.email}
            onChange={(event) => change({ email: event.target.value }, 'email')}
            onBlur={() => checkField('email')}
            className={`${FIELD_CLASS} ${errors.email ? INVALID_CLASS : VALID_CLASS}`}
          />
          {errors.email && <FieldError id="join-email-error" message={copy.errEmail} />}
        </div>

        <div>
          <SelectField
            id="join-language"
            name="preferredLanguage"
            label={copy.preferredLanguageLabel}
            value={preferredLanguage}
            onChange={(next) => {
              if (isPrelaunchLang(next)) setPreferredLanguage(next)
            }}
          >
            {LANGUAGES.map(({ code, label }) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </SelectField>
        </div>

        <div>
          <SelectField
            id="join-persona"
            name="persona"
            label={copy.personaLabel}
            value={persona}
            empty={!persona}
            onChange={(next) => choosePersona(next as Persona | '')}
          >
            <option value="">{copy.personaPlaceholder}</option>
            {PERSONAS.map((key) => (
              <option key={key} value={key}>{copy.personas[key]}</option>
            ))}
          </SelectField>

          {/* Always in the page, so it can open and close: `invisible` and `disabled` keep it out of the tab order while shut. */}
          <div className={`grid grid-cols-1 transition-[grid-template-rows,opacity,margin-top,visibility] duration-300 ease-out motion-reduce:transition-none ${otherOpen ? 'visible mt-3 grid-rows-[1fr] opacity-100' : 'invisible mt-0 grid-rows-[0fr] opacity-0'}`}>
            {/* The padding gives the focus ring room inside overflow-hidden. */}
            <div className="-m-1 min-h-0 overflow-hidden p-1">
              <label htmlFor="join-persona-other" className="mb-1.5 block text-sm font-semibold text-ink">{copy.personaOtherLabel}</label>
              <input
                id="join-persona-other"
                type="text"
                name="personaOtherDescription"
                autoComplete="off"
                enterKeyHint="done"
                maxLength={MAX_PERSONA_OTHER_LENGTH}
                disabled={!otherOpen}
                placeholder={copy.personaOtherPlaceholder}
                value={personaOther}
                onChange={(event) => setPersonaOther(event.target.value)}
                className={`${FIELD_CLASS} ${VALID_CLASS} scroll-mb-28`}
              />
            </div>
          </div>
        </div>

        <div>
          <SelectField
            id="join-referral"
            name="referralSource"
            label={copy.referralLabel}
            value={referralSource}
            empty={!referralSource}
            onChange={(next) => setReferralSource(next as ReferralSource | '')}
          >
            <option value="">{copy.referralPlaceholder}</option>
            {REFERRAL_SOURCES.map((key) => (
              <option key={key} value={key}>{copy.referralSources[key]}</option>
            ))}
          </SelectField>
        </div>

        <div>
          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm leading-relaxed text-body">
            <input
              data-field="consent"
              type="checkbox"
              name="consent"
              required
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={errors.consent ? 'join-consent-error' : undefined}
              checked={values.consent}
              onChange={(event) => change({ consent: event.target.checked }, 'consent')}
              className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded accent-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
            />
            <span className="[text-wrap:pretty]">{copy.consent}</span>
          </label>
          {errors.consent && <FieldError id="join-consent-error" message={copy.errConsent} />}
        </div>
      </div>

      <div aria-live="polite">
        {formError && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
            <AlertCircle aria-hidden="true" size={16} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" />
            <span>{formError}</span>
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="group mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-brand px-6 text-center text-base font-bold text-white shadow-[0_8px_24px_rgba(0,56,184,.25)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-brandDark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 active:translate-y-0 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-80"
      >
        {busy ? <Loader2 aria-hidden="true" size={20} strokeWidth={1.75} className="animate-spin" /> : null}
        {busy ? copy.submitting : copy.submit}
        {busy ? null : <Arrow aria-hidden="true" size={20} strokeWidth={1.75} />}
      </button>
    </form>
  )
}
