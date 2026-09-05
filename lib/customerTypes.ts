import type { TranslationKey } from '@/lib/i18n/translations'

export const CUSTOMER_TYPES: { value: string; labelKey: TranslationKey; color: string }[] = [
  { value: 'student', labelKey: 'signup_customerType_student', color: '#2563eb' },
  { value: 'new_immigrant', labelKey: 'signup_customerType_newImmigrant', color: '#059669' },
  { value: 'long_term_program', labelKey: 'signup_customerType_longTermProgram', color: '#7c3aed' },
  { value: 'taglit', labelKey: 'signup_customerType_taglit', color: '#db2777' },
  { value: 'traveler', labelKey: 'signup_customerType_traveler', color: '#0891b2' },
  { value: 'other', labelKey: 'signup_customerType_other', color: '#d97706' },
]

// Shown for a member who hasn't set a customer type yet — see dash_segment_value_unset.
export const CUSTOMER_TYPE_UNSET_COLOR = '#94a3b8'
