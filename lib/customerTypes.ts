import type { TranslationKey } from '@/lib/i18n/translations'

export const CUSTOMER_TYPES: { value: string; labelKey: TranslationKey; color: string }[] = [
  { value: 'student', labelKey: 'signup_customerType_student', color: '#2563eb' },
  { value: 'new_immigrant', labelKey: 'signup_customerType_newImmigrant', color: '#059669' },
  { value: 'taglit', labelKey: 'signup_customerType_taglit', color: '#db2777' },
  { value: 'long_term_program', labelKey: 'signup_customerType_longTermProgram', color: '#7c3aed' },
  { value: 'traveler', labelKey: 'signup_customerType_traveler', color: '#0891b2' },
  { value: 'other', labelKey: 'signup_customerType_other', color: '#d97706' },
]

// Shown for a member who hasn't set a customer type yet — see dash_segment_value_unset.
export const CUSTOMER_TYPE_UNSET_COLOR = '#94a3b8'

/**
 * What a profile shows for the member's customer type: for 'other', the text
 * they typed during onboarding (users/{uid}.customerTypeOther), else "Other";
 * otherwise the type's label; null when no type is set.
 */
export function customerTypeLabel(
  type: string,
  note: string,
  t: (key: TranslationKey) => string
): string | null {
  const option = CUSTOMER_TYPES.find((o) => o.value === type)
  if (!option) return null
  const typed = type === 'other' ? note.trim() : ''
  return typed || t(option.labelKey)
}
