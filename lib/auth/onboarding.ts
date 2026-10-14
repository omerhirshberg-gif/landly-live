import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import type { Lang } from '@/lib/i18n/translations'

// The post-sign-in onboarding rules, shared by the web AuthScreen and the
// mobile login screen so both ask the same questions in the same order and
// store the same values. Pure functions only — each platform owns its UI.
//
// Credentials come first (the Sign Up tab is only email + password); these
// steps run once the member is signed in and their profile is incomplete.

export type OnboardingStep = 'language' | 'persona' | 'phone' | 'notifications'

export const ONBOARDING_STEPS: readonly OnboardingStep[] = ['language', 'persona', 'phone', 'notifications']

/** Every app language, offered on the first step (each label in its own language). */
export const ONBOARDING_LANGS: readonly { code: Lang; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'he', label: 'עברית', flag: '🇮🇱' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
]

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1] ?? null
}

export function prevStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step)
  return index > 0 ? ONBOARDING_STEPS[index - 1] : null
}

/** 1-based position and total, for the "Step 2 of 4" header. */
export function stepProgress(step: OnboardingStep): { current: number; total: number } {
  return { current: ONBOARDING_STEPS.indexOf(step) + 1, total: ONBOARDING_STEPS.length }
}

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

/** The Sign Up form's error key for its fields, or null when they can be submitted. */
export function signUpFormError(
  email: string,
  password: string,
  confirm: string
): 'onb_emailInvalid' | 'onb_passwordTooShort' | 'onb_passwordMismatch' | null {
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

// ── Profile ─────────────────────────────────────────────────────────────
/** False until the onboarding steps have stored a persona and a phone number. */
export function isProfileComplete(doc: { phone: string; customerType: string } | null): boolean {
  return !!doc && !!doc.phone && !!doc.customerType
}
