import type { BrandIndexEntry } from './branches'
import type { OfferDocument } from './offerDocument'
import { normalizeChains } from './perkScope'

// Which brand tiles a multi-chain pass shows. The live offer carries them (`brandIndex`, built by withLiveBrandIndex from the brands
// on sale right now). A bought voucher freezes only the chain NAMES, so it has no index: its names are matched, by a normalised
// name, to the live single-brand Raayonit offers, which hold each brand's logo, branch count and own page. Pure; shared with the
// Expo app. The logo lives on the brand's offer, so nothing here touches the catalogue snapshot (it would weigh down the bundles).

/** A name as a comparison key: case, spacing, punctuation and diacritics ("CaféCafé", "Café Café", "cafe cafe") drop out. */
export const brandNameKey = (name: string): string => name.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

type BrandOffer = Pick<OfferDocument, 'id' | 'fulfillmentType' | 'perkScope' | 'brandName' | 'businessName' | 'businessTranslations' | 'businessLogoUrl' | 'imageUrl' | 'chainsCount' | 'logoKind'>

/** One live single-brand Raayonit offer as a brand tile; null for any other offer. */
export function brandEntryOf(offer: BrandOffer): BrandIndexEntry | null {
  if (offer.fulfillmentType !== 'raayonit_pool' || offer.perkScope === 'multi_chain') return null
  const name = (offer.brandName || offer.businessName || '').trim()
  if (!name) return null
  return {
    offerId: offer.id,
    name,
    nameTranslations: offer.businessTranslations,
    logoUrl: offer.businessLogoUrl || offer.imageUrl || '',
    branchCount: Number(offer.chainsCount) || 0,
    ...(offer.logoKind === 'photo' ? { photo: true } : {}),
  }
}

/** Biggest chains first (most branches), then by name; the order of the multi-chain brand strip. */
export function sortBrandsByReach<T extends Pick<BrandIndexEntry, 'name' | 'branchCount'>>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => b.branchCount - a.branchCount || a.name.localeCompare(b.name, 'he'))
}

export interface ChainBrandSubject {
  /** The offer the pass was bought from; its live card, while on sale, already carries the brand index. */
  offerId?: string
  perkScope?: unknown
  participatingChains?: unknown
  /** The subject is the live multi-chain offer itself, which honours every live brand: with no index and no chain names matched, all of them. */
  allLiveBrands?: boolean
}

/** The brand tiles for a multi-chain offer or voucher: the live offer's own index, else its frozen chain names matched to live brand offers. Empty when nothing matches. */
export function resolveChainBrands(subject: ChainBrandSubject, offers: readonly OfferDocument[]): BrandIndexEntry[] {
  if (subject.perkScope !== 'multi_chain') return []
  const live = subject.offerId ? offers.find((o) => o.id === subject.offerId)?.brandIndex : undefined
  if (live?.length) return live
  const byName = new Map<string, BrandIndexEntry>()
  for (const offer of offers) {
    const entry = brandEntryOf(offer)
    if (!entry) continue
    byName.set(brandNameKey(entry.name), entry)
    // The English name too (a chain stored under it matches the same brand).
    const en = offer.businessTranslations?.fields?.en?.businessName?.text
    if (en) byName.set(brandNameKey(en), entry)
  }
  const found = new Map<string, BrandIndexEntry>()
  for (const chain of normalizeChains(subject.participatingChains)) {
    const entry = byName.get(brandNameKey(chain))
    if (entry) found.set(entry.offerId, entry)
  }
  if (found.size === 0 && subject.allLiveBrands) return [...byName.values()].filter((entry, i, all) => all.findIndex((o) => o.offerId === entry.offerId) === i)
  return [...found.values()]
}

type NetworkOffer = Pick<OfferDocument, 'fulfillmentType' | 'perkScope' | 'brandName' | 'businessName'>

/** How many distinct brands honour a Raayonit voucher right now: the live single-brand Raayonit offers, by normalised name. */
export function liveRaayonitBrandCount(offers: readonly NetworkOffer[]): number {
  const names = new Set<string>()
  for (const offer of offers) {
    if (offer.fulfillmentType !== 'raayonit_pool' || offer.perkScope === 'multi_chain') continue
    const key = brandNameKey(offer.brandName || offer.businessName || '')
    if (key) names.add(key)
  }
  return names.size
}

/** Every live single-brand Raayonit offer as a brand tile, one per brand name: the whole network a voucher works at. */
export function liveRaayonitBrands(offers: readonly OfferDocument[]): BrandIndexEntry[] {
  const byName = new Map<string, BrandIndexEntry>()
  for (const offer of offers) {
    const entry = brandEntryOf(offer)
    if (entry && !byName.has(brandNameKey(entry.name))) byName.set(brandNameKey(entry.name), entry)
  }
  return [...byName.values()]
}
