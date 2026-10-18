import type { TranslationKey } from '@/lib/i18n/translations'

// The member types offered at onboarding and on the Member type settings page
// (web and app), in display order, stored as users/{uid}.customerType.
export const CUSTOMER_TYPES = [
  { value: 'student', labelKey: 'signup_customerType_student', color: '#2563eb' },
  { value: 'new_immigrant', labelKey: 'signup_customerType_newImmigrant', color: '#059669' },
  { value: 'lone_soldier', labelKey: 'signup_customerType_loneSoldier', color: '#4d7c0f' },
  { value: 'taglit', labelKey: 'signup_customerType_taglit', color: '#db2777' },
  { value: 'long_term_program', labelKey: 'signup_customerType_longTermProgram', color: '#7c3aed' },
  { value: 'traveler', labelKey: 'signup_customerType_traveler', color: '#0891b2' },
  { value: 'other', labelKey: 'signup_customerType_other', color: '#d97706' },
] as const satisfies readonly { value: string; labelKey: TranslationKey; color: string }[]

export type CustomerType = (typeof CUSTOMER_TYPES)[number]['value']

export const OTHER_CUSTOMER_TYPE = 'other'
export const MAX_PERSONA_NOTE_LENGTH = 120

/** The optional "Other" note as stored: only kept for 'other', trimmed and capped. */
export function personaNote(customerType: string, note: string): string {
  if (customerType !== OTHER_CUSTOMER_TYPE) return ''
  return note.replace(/\s+/g, ' ').trim().slice(0, MAX_PERSONA_NOTE_LENGTH).trim()
}

/** A value users/{uid}.customerType may hold; stored data is a plain string, so check before trusting it. */
export function isCustomerType(value: unknown): value is CustomerType {
  return typeof value === 'string' && CUSTOMER_TYPES.some((o) => o.value === value)
}

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
  const typed = type === OTHER_CUSTOMER_TYPE ? note.trim() : ''
  return typed || t(option.labelKey)
}
