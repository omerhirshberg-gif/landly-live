import type { TranslationKey } from '@/lib/i18n/translations'

// The "Why are you leaving?" choices on the account-deletion form, shared by
// the website (components/settings/DeleteAccountForm.tsx), the app
// (landly-mobile DeleteAccountSheet) and the route that checks them
// (app/api/account/delete-request). Optional: no reason is sent as null.
export const DELETION_REASONS = ['not_using', 'missing_perks', 'privacy', 'moving', 'other'] as const
export type DeletionReason = (typeof DELETION_REASONS)[number]

export const DELETION_REASON_KEYS: Record<DeletionReason, TranslationKey> = {
  not_using: 'del_reason_not_using',
  missing_perks: 'del_reason_missing_perks',
  privacy: 'del_reason_privacy',
  moving: 'del_reason_moving',
  other: 'del_reason_other',
}

export const DELETION_DETAILS_MAX = 1000

export function isDeletionReason(value: unknown): value is DeletionReason {
  return typeof value === 'string' && (DELETION_REASONS as readonly string[]).includes(value)
}
