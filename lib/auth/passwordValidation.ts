// The password rule for every place a customer sets one (web and app sign-up,
// /reset-password): at least 6 characters with an uppercase letter, a
// lowercase letter and a digit. Letters are Latin A–Z / a–z (scripts such as
// Hebrew have no case, so they count toward the length only).
// Type-only imports, so the native app can share it too.

import type { TranslationKey } from '@/lib/i18n/translations'

export const MIN_PASSWORD_LENGTH = 6

export const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/

export interface PasswordRequirements {
  hasMinLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
}

/** Each requirement on its own, for the checklist under the password field. */
export function passwordRequirements(password: string): PasswordRequirements {
  return {
    hasMinLength: password.length >= MIN_PASSWORD_LENGTH,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
  }
}

export function isStrongPassword(password: string): boolean {
  return STRONG_PASSWORD_PATTERN.test(password)
}

/** The checklist rows, in display order, with their translation keys. */
export const PASSWORD_REQUIREMENT_ITEMS: { key: keyof PasswordRequirements; label: TranslationKey }[] = [
  { key: 'hasMinLength', label: 'onb_pwReq_length' },
  { key: 'hasUppercase', label: 'onb_pwReq_upper' },
  { key: 'hasLowercase', label: 'onb_pwReq_lower' },
  { key: 'hasNumber', label: 'onb_pwReq_number' },
]
