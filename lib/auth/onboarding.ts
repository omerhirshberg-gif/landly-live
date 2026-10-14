import { getCountries, getCountryCallingCode, isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import type { Lang } from '@/lib/i18n/translations'
import { normalizePersonName } from './names'

// The post-sign-in onboarding rules, shared by the web AuthScreen and the
// mobile login screen so both ask the same questions in the same order and
// store the same values. Pure functions only — each platform owns its UI.
//
// Credentials and name come first (the Sign Up tab); these cards run once
// the member is signed in and hasn't finished onboarding: a welcome, four
// questions, then a celebration. Answers are saved when the notifications
// card is left, so the celebration only shows once they're stored.

export type OnboardingStep = 'welcome' | 'language' | 'persona' | 'phone' | 'notifications' | 'done'

export const ONBOARDING_STEPS: readonly OnboardingStep[] = ['welcome', 'language', 'persona', 'phone', 'notifications', 'done']

/** Every app language, offered on the language card (each label in its own language), Hebrew last. */
export const ONBOARDING_LANGS: readonly { code: Lang; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'he', label: 'עברית', flag: '🇮🇱' },
]

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1] ?? null
}

/** The card ← goes back to, or null: nothing before the welcome, and the celebration is past saving. */
export function prevStep(step: OnboardingStep): OnboardingStep | null {
  if (step === 'done') return null
  const index = ONBOARDING_STEPS.indexOf(step)
  return index > 0 ? ONBOARDING_STEPS[index - 1] : null
}

/** How far through the wizard a card is, 0 on the welcome to 1 on the celebration, for the header's progress bar. */
export function onboardingProgress(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step) / (ONBOARDING_STEPS.length - 1)
}

// ── Name ────────────────────────────────────────────────────────────────
// Kept in ./names (no libphonenumber), so pages that only greet stay light.
export { MAX_NAME_LENGTH, fullName, greetingName, normalizePersonName, splitDisplayName } from './names'

// ── Identity ────────────────────────────────────────────────────────────
// A shape check only; Firebase has the final word (auth/invalid-email).
export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

// ── Password ────────────────────────────────────────────────────────────
/** Firebase Auth's own minimum. */
export const MIN_PASSWORD_LENGTH = 6

/** 0 = empty, 1 = weak (too short or one kind of character), 2 = fair, 3 = strong. */
export type PasswordStrength = 0 | 1 | 2 | 3

export type SignUpFormError =
  | 'onb_firstNameRequired'
  | 'onb_lastNameRequired'
  | 'onb_emailInvalid'
  | 'onb_passwordTooShort'
  | 'onb_passwordMismatch'

/** The Sign Up form's first error key, in field order, or null when it can be submitted. */
export function signUpFormError(fields: {
  firstName: string
  lastName: string
  email: string
  password: string
  confirm: string
}): SignUpFormError | null {
  const { firstName, lastName, email, password, confirm } = fields
  if (!normalizePersonName(firstName)) return 'onb_firstNameRequired'
  if (!normalizePersonName(lastName)) return 'onb_lastNameRequired'
  if (!isPlausibleEmail(email)) return 'onb_emailInvalid'
  if (password.length < MIN_PASSWORD_LENGTH) return 'onb_passwordTooShort'
  if (password !== confirm) return 'onb_passwordMismatch'
  return null
}

export function passwordStrength(password: string): PasswordStrength {
  if (!password) return 0
  if (password.length < MIN_PASSWORD_LENGTH) return 1
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length
  if (password.length >= 10 && kinds >= 3) return 3
  if (password.length >= 8 && kinds >= 2) return 2
  return 1
}

// ── Phone ───────────────────────────────────────────────────────────────
export const DEFAULT_COUNTRY: CountryCode = 'IL'

// Listed first in the picker: where most Landly members come from.
const PINNED: readonly CountryCode[] = ['IL', 'US', 'GB', 'FR', 'RU', 'UA', 'CA', 'AR', 'BR', 'DE', 'ES', 'AU', 'ZA']

export interface Country {
  code: CountryCode
  callingCode: string
  flag: string
}

// Regional-indicator pair: "IL" -> 🇮🇱.
function flagEmoji(code: string): string {
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export function toCountry(code: CountryCode): Country {
  return { code, callingCode: getCountryCallingCode(code), flag: flagEmoji(code) }
}

let cachedCountries: { pinned: Country[]; rest: Country[] } | null = null

/** Every country libphonenumber knows: the common ones, then the rest. */
export function listCountries(): { pinned: Country[]; rest: Country[] } {
  if (!cachedCountries) {
    cachedCountries = {
      pinned: PINNED.map(toCountry),
      rest: getCountries()
        .filter((code) => !PINNED.includes(code))
        .map(toCountry),
    }
  }
  return cachedCountries
}

/**
 * The country's name in `lang`, or its ISO code where the runtime has no
 * Intl.DisplayNames (older Hermes builds).
 */
export function countryName(code: CountryCode, lang: Lang): string {
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
      return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code
    }
  } catch {
    // Unsupported locale — fall through to the code
  }
  return code
}

/**
 * The stored E.164 number, or null if it isn't a valid number. A number
 * typed with its own "+country" prefix wins over the selected country.
 */
export function phoneToE164(country: CountryCode, input: string): string | null {
  const parsed = parsePhoneNumberFromString(input, country)
  return parsed?.isValid() ? parsed.number : null
}

// ── Persona ─────────────────────────────────────────────────────────────
/** The persona that reveals the optional free-text note. */
export const OTHER_CUSTOMER_TYPE = 'other'
export const MAX_PERSONA_NOTE_LENGTH = 120

/** The optional "Other" note as stored: only kept for 'other', trimmed and capped. */
export function personaNote(customerType: string, note: string): string {
  if (customerType !== OTHER_CUSTOMER_TYPE) return ''
  return note.replace(/\s+/g, ' ').trim().slice(0, MAX_PERSONA_NOTE_LENGTH).trim()
}

// ── Profile ─────────────────────────────────────────────────────────────
// Kept in ./onboardingStatus (no libphonenumber), so the auth provider that
// every page loads stays light.
export { isOnboardingComplete } from './onboardingStatus'

// ── Draft ───────────────────────────────────────────────────────────────
// The answers so far and the card on screen, kept on the device (web
// localStorage, Expo AsyncStorage) while the wizard runs, so a reload or an
// app restart comes back to the same card instead of the welcome. Nothing
// reaches Firestore until the notifications card, as before.

export interface OnboardingDraft {
  step: Exclude<OnboardingStep, 'done'>
  customerType: string
  customerTypeOther: string
  country: CountryCode
  phone: string
  /** "Skip for now" on the WhatsApp card; cleared by continuing with a number. */
  phoneSkipped: boolean
}

const MAX_DRAFT_FIELD_LENGTH = 64

/** Per member, so a shared browser never hands one member's answers to another. */
export function onboardingDraftKey(uid: string): string {
  return `landly_onboarding_draft_${uid}`
}

export function serializeOnboardingDraft(draft: OnboardingDraft): string {
  return JSON.stringify(draft)
}

/**
 * The stored draft, or null when there's none or it can't be trusted (bad
 * JSON, an unknown card, wrong types). Never resumes on the celebration:
 * that card only shows once the answers are saved.
 */
export function parseOnboardingDraft(raw: string | null | undefined): OnboardingDraft | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object') return null
  const d = value as Record<string, unknown>
  const text = (v: unknown, max = MAX_DRAFT_FIELD_LENGTH) => (typeof v === 'string' && v.length <= max ? v : null)
  const step = d.step
  if (typeof step !== 'string' || step === 'done' || !ONBOARDING_STEPS.includes(step as OnboardingStep)) return null
  const customerType = text(d.customerType)
  const customerTypeOther = text(d.customerTypeOther, MAX_PERSONA_NOTE_LENGTH)
  const phone = text(d.phone)
  const country = typeof d.country === 'string' && isSupportedCountry(d.country) ? d.country : null
  if (customerType === null || customerTypeOther === null || phone === null || country === null || typeof d.phoneSkipped !== 'boolean') return null
  return { step: step as OnboardingDraft['step'], customerType, customerTypeOther, country, phone, phoneSkipped: d.phoneSkipped }
}
