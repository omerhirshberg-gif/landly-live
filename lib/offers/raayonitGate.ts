// The Raayonit display gate for offers, pure and shared by the cached public list, the SEO reads and the tests.
//
// Raayonit sells ONE multi-chain voucher per face value (100 / 150 / 200 / 250 ILS): the "general" card (perkScope multi_chain).
// The per-brand cards the sync keeps (one per participating business) are catalogue data, never a storefront product:
//   - they are always removed from the public offer list and cannot be bought;
//   - the general card lists them as an informational "where you can redeem" catalogue (brandIndex), and only while
//     isRaayonitDisplayEnabled(); with the flag off the card carries no business names, logos, images or branch lists.

export interface RaayonitGateData { fulfillmentType?: unknown; perkScope?: unknown }

/** A per-business Raayonit card (catalogue data), as opposed to the general multi-chain voucher. */
export const isRaayonitBrandCard = (d: RaayonitGateData): boolean => d.fulfillmentType === 'raayonit_pool' && d.perkScope !== 'multi_chain'
export const isRaayonitGeneralCard = (d: RaayonitGateData): boolean => d.fulfillmentType === 'raayonit_pool' && d.perkScope === 'multi_chain'

/** Fields that name Raayonit's businesses or show their imagery. */
const BRANDED_FIELDS = ['brandIndex', 'participatingChains', 'participatingPlaces', 'branches', 'businessLogoUrl', 'universalRedemptionGuide'] as const

/**
 * The general card as the public may see it: with the flag off every business name, logo, image and branch list is removed
 * and the chain count is dropped, so the card reads as a plain multi-chain voucher.
 */
export function gateGeneralCard<T extends Record<string, unknown>>(data: T, displayEnabled: boolean, neutralLabels?: Readonly<Record<string, string>>): T {
  if (displayEnabled) return data
  const out: Record<string, unknown> = { ...data }
  for (const field of BRANDED_FIELDS) delete out[field]
  out.chainsCount = 0
  out.logoKind = 'none'
  // "Super Tav" is Raayonit's own product name: outside Hebrew the card is titled with the neutral label instead.
  if (neutralLabels) {
    const merge = (existing: unknown, field: string) => Object.fromEntries(Object.entries(neutralLabels).filter(([lang]) => lang !== 'he').map(([lang, label]) => [lang, { ...((existing as Record<string, Record<string, unknown>> | null | undefined)?.[lang] ?? {}), [field]: label }]))
    out.translations = { ...((out.translations as object | null) ?? {}), ...merge(out.translations, 'title') }
    out.businessTranslations = { ...((out.businessTranslations as object | null) ?? {}), ...merge(out.businessTranslations, 'businessName') }
  }
  return out as T
}
