import { manualOverridesFrom, parseContentTranslations, type ContentOverrides, type ContentTranslations } from '../i18n/contentTranslation'

// The four fields of an offer an admin writes in free text, and so the ones
// Cloud Translation fills in for the other languages. The business name is
// left as written: it's a brand. Orders and vouchers keep their own copy
// (offerTitle instead of title), made at purchase like the terms themselves.
export const OFFER_TEXT_FIELDS = ['title', 'description', 'redemptionTerms', 'redemptionInstructions'] as const
export type OfferTextField = (typeof OFFER_TEXT_FIELDS)[number]
export type OfferTranslations = ContentTranslations<OfferTextField>

export function parseOfferTranslations(raw: unknown): OfferTranslations | null {
  return parseContentTranslations(raw, OFFER_TEXT_FIELDS)
}

/** The admin's own translations, per language and field, as the offer form sends them. */
export type TranslationOverrides = ContentOverrides<OfferTextField>

/** An offer's stored manual translations as overrides (the edit form's starting point; a re-translation keeps them). */
export function manualOverridesOf(existing: OfferTranslations | null | undefined): TranslationOverrides {
  return manualOverridesFrom(existing)
}

/** The four source fields of an offer, or of a voucher/order (whose title is offerTitle); '' for any missing. */
export function offerTextSources(
  item: { title?: string; offerTitle?: string; description?: string; redemptionTerms?: string; redemptionInstructions?: string } | null | undefined
): Record<OfferTextField, string> {
  return {
    title: item?.title ?? item?.offerTitle ?? '',
    description: item?.description ?? '',
    redemptionTerms: item?.redemptionTerms ?? '',
    redemptionInstructions: item?.redemptionInstructions ?? '',
  }
}
