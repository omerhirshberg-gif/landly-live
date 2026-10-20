import 'server-only'
import { activeTranslator } from './cloudTranslate'
import { buildOfferTranslations, parseTranslationOverrides, type OfferTextSource } from './offerTranslations'
import { parseOfferTranslations } from '@/lib/offers/offerText'

/**
 * The `translations` to store with an offer being created or edited, from
 * its text, its stored translations (edits) and the form's manual ones.
 * A malformed request is the only failure; translation trouble comes back as
 * a warning for the admin, and the offer saves regardless.
 */
export async function translationsForSave(source: OfferTextSource, existingRaw: unknown, rawOverrides: unknown) {
  const overrides = parseTranslationOverrides(rawOverrides)
  if (!overrides.ok) return overrides
  const result = await buildOfferTranslations(source, parseOfferTranslations(existingRaw), overrides.overrides, activeTranslator())
  if (result.warning) console.warn(`Offer translation: ${result.warning}`)
  return { ok: true as const, translations: result.translations, warning: result.warning }
}

export function offerTextSource(offer: { title?: unknown; description?: unknown }, terms: { redemptionTerms: string }, redemption: { redemptionInstructions: string }): OfferTextSource {
  return {
    title: typeof offer.title === 'string' ? offer.title : '',
    description: typeof offer.description === 'string' ? offer.description : '',
    redemptionTerms: terms.redemptionTerms,
    redemptionInstructions: redemption.redemptionInstructions,
  }
}
