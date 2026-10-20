import { localizeText, manualOverridesFrom, parseContentTranslations, type ContentOverrides, type ContentTranslations, type LocalizedText } from '../i18n/contentTranslation'
import type { Lang } from '../i18n/translations'

// A business's name in the reader's language. Stored on businesses/{uid} as
// `translations` and copied onto its offers (and, at purchase, its orders and
// vouchers) as `businessTranslations`, in the same shape as an offer's own
// translations (lib/i18n/contentTranslation.ts). Kept apart from the offer's
// because the two can be in different languages. Only a name written in
// Hebrew letters is machine-translated: a Latin-script name is a brand and
// stays as written everywhere, unless the admin writes their own wording.
// Pure and shared with the Expo app.

export const BUSINESS_TEXT_FIELDS = ['businessName'] as const
export type BusinessTextField = (typeof BUSINESS_TEXT_FIELDS)[number]
export type BusinessTranslations = ContentTranslations<BusinessTextField>
export type BusinessNameOverrides = ContentOverrides<BusinessTextField>

const HEBREW_LETTER = /[֐-׿]/

/** Whether Google should translate this name: only when it's written in Hebrew letters. */
export function isHebrewScriptName(name: string): boolean {
  return HEBREW_LETTER.test(name)
}

export function parseBusinessTranslations(raw: unknown): BusinessTranslations | null {
  return parseContentTranslations(raw, BUSINESS_TEXT_FIELDS)
}

/** A business's stored manual translations as overrides (the edit form's starting point). */
export function businessNameOverridesOf(existing: BusinessTranslations | null | undefined): BusinessNameOverrides {
  return manualOverridesFrom(existing)
}

/** The business name of an offer, order or voucher in the reader's language; the name as written when there's none. */
export function localizedBusinessName(
  item: { businessName: string; businessTranslations?: BusinessTranslations | null } | null | undefined,
  lang: Lang
): LocalizedText {
  return localizeText(item?.businessName ?? '', item?.businessTranslations, lang, 'businessName')
}

/** Every stored spelling of the name, for search ("Miznonki" finds "מזנונקי"). */
export function businessNameVariants(item: { businessName: string; businessTranslations?: BusinessTranslations | null }): string[] {
  const variants = [item.businessName]
  for (const byField of Object.values(item.businessTranslations?.fields ?? {})) {
    if (byField?.businessName?.text) variants.push(byField.businessName.text)
  }
  return variants
}
