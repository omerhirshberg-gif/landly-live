import type { OfferDocument } from '../firebase/offers'
import type { TranslationKey } from '../i18n/translations'
import { businessNameVariants } from '../business/businessText'
import { isChain } from '../offers/discoverTab'
import { RAAYONIT_HUB } from '../offers/offerRoutes'

// The "Raayonit Card" referral on a perks search that finds no GoLandly perk: when the words name a business that honours the card, the
// search points there. Pure, shared by the website (/categories) and the Expo Perks tab.

// Apostrophes and quote marks vanish (so "PATRICK'S", "PATRICK’S" and "PATRICKS" are one word); other punctuation becomes a space.
const APOSTROPHES = /['’‘ʼʻ`´′׳]/g
const PUNCTUATION = /[\p{P}\p{S}]+/gu

/** Lower-cased, diacritics and apostrophes removed, other punctuation collapsed to single spaces. */
export function normalizeLoose(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(APOSTROPHES, '')
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The chains (never the flagship card) whose name, in any stored language, contains the query. */
export function matchRaayonitChains(offers: readonly OfferDocument[], query: string): OfferDocument[] {
  const q = normalizeLoose(query)
  if (q.length < 2) return []
  return offers.filter((o) => isChain(o) && businessNameVariants(o).some((name) => normalizeLoose(name).includes(q)))
}

export type ReferralTarget = { kind: 'offer'; offer: OfferDocument } | { kind: 'hub'; path: string; query: string }

/** One match opens that chain's page; several open the hub with the search filled in. */
export function referralTarget(matches: readonly OfferDocument[], query: string): ReferralTarget | null {
  if (matches.length === 0) return null
  if (matches.length === 1) return { kind: 'offer', offer: matches[0] }
  return { kind: 'hub', path: `${RAAYONIT_HUB}?q=${encodeURIComponent(query.trim())}`, query: query.trim() }
}

export const REFERRAL_KEYS = {
  one: 'perks_raayonit_ref_title' as TranslationKey,
  more: 'perks_raayonit_ref_title_more' as TranslationKey,
  sub: 'perks_raayonit_ref_sub' as TranslationKey,
  cta: 'perks_raayonit_ref_cta' as TranslationKey,
}

/** The headline around the venue's name: the name itself is rendered (isolated) between `before` and `after`. */
export function referralHeadline(template: string, count: number): { before: string; after: string } {
  const [before, after = ''] = template.replace('{count}', String(count)).split('{venue}')
  return { before, after }
}

/** What the card needs from the matches: the shown name and how many other chains match. */
export function referralSummary(matches: readonly OfferDocument[], nameOf: (o: OfferDocument) => string): { venue: string; others: number } | null {
  if (matches.length === 0) return null
  return { venue: nameOf(matches[0]), others: matches.length - 1 }
}
