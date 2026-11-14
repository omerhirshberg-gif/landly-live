// Who honours a perk. A local-business perk belongs to one onboarded business (`businessId`).
// A Multipass perk belongs to no business document: it carries a brand's display name, and
// a multi-chain voucher (BUYME All Style and the like) also lists the chains that honour it.
// One pure validator for the admin API, the batch importer and the tests. Shared with Expo.

import { parseFulfillmentType, type FulfillmentType } from '../inventory/types'
import { parseParticipatingPlaces, placeChainName, type ParticipatingPlace } from '../geo'

export const PERK_SCOPES = ['single_business', 'multi_chain'] as const
export type PerkScope = (typeof PERK_SCOPES)[number]

export const MAX_BRAND_NAME_LENGTH = 80
export const MAX_CHAIN_NAME_LENGTH = 60
export const MAX_CHAINS = 40
export const MAX_GUIDE_LENGTH = 1000

/** Offers from before scopes existed are all single-business. */
export function parsePerkScope(value: unknown): PerkScope {
  return value === 'multi_chain' ? 'multi_chain' : 'single_business'
}

const clean = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')

/** Chain names, trimmed, empties dropped, case-insensitive duplicates removed (first spelling kept). */
export function normalizeChains(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[;,\n]/) : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of list) {
    const name = clean(item)
    const key = name.toLowerCase()
    if (name && !seen.has(key)) {
      seen.add(key)
      out.push(name)
    }
  }
  return out
}

export interface PerkScopeInput {
  fulfillmentType: FulfillmentType
  perkScope?: unknown
  businessId?: unknown
  brandName?: unknown
  participatingChains?: unknown
  /** Branches picked from Google Places (single-brand lists only); see lib/geo.ts. */
  participatingPlaces?: unknown
  universalRedemptionGuide?: unknown
  isNationwide?: unknown
}

/** What gets stored on the offer (fields that don't apply are absent). */
export interface PerkScopeFields {
  perkScope: PerkScope
  /** A chain redeemable across its branches: hides the single address and navigation. Always true for Multipass. */
  isNationwide: boolean
  businessId?: string
  brandName?: string
  participatingChains?: string[]
  /** The branches picked from Google Places, in the order listed; the chain names above include their names. */
  participatingPlaces?: ParticipatingPlace[]
  chainsCount?: number
  universalRedemptionGuide?: { he: string; en: string }
}

export type PerkScopeResult = { ok: true; fields: PerkScopeFields } | { ok: false; error: string }

export function parsePerkScopeFields(input: PerkScopeInput): PerkScopeResult {
  const businessId = clean(input.businessId)
  const brandName = clean(input.brandName)
  // A single-brand list is branches picked from Google (names and positions) plus any typed names: the chain
  // names are the picked branches' names, then the typed ones that are not one of them. A multi-chain pass
  // lists brands, which are only ever typed.
  const scope = input.perkScope === undefined || input.perkScope === null || input.perkScope === '' ? undefined : input.perkScope
  const places = scope === 'multi_chain' ? [] : parseParticipatingPlaces(input.participatingPlaces)
  const placeNames = new Set(places.map((place) => placeChainName(place).toLowerCase()))
  const typed = normalizeChains(input.participatingChains).filter((name) => !placeNames.has(name.toLowerCase()))
  const chains = normalizeChains([...places.map(placeChainName), ...typed])
  const guideRaw = input.universalRedemptionGuide as { he?: unknown; en?: unknown } | null | undefined
  const guide = { he: clean(guideRaw?.he), en: clean(guideRaw?.en) }
  const hasGuide = !!(guide.he || guide.en)
  const listError = chainsError(chains)
  const list = chains.length > 0
    ? { participatingChains: chains, chainsCount: places.length + typed.length, ...(places.length > 0 ? { participatingPlaces: places } : {}) }
    : {}

  // A manual multi-chain pass: redeemed with its issuer at the participating chains, so it belongs to no business.
  if (input.fulfillmentType === 'direct_merchant' && scope === 'multi_chain') return parseMultiChain({ businessId, brandName, chains, guide, hasGuide, listError })

  if (input.fulfillmentType === 'direct_merchant') {
    if (scope !== undefined && scope !== 'single_business') return { ok: false, error: 'perkScope must be single_business or multi_chain.' }
    if (!businessId) return { ok: false, error: 'A local-business perk needs a business.' }
    if (brandName || hasGuide) return { ok: false, error: 'brandName and the redemption guide are for Multipass perks only.' }
    const isNationwide = input.isNationwide === true
    // Participating stores narrow a nationwide offer; an offer at one location has none.
    if (chains.length > 0 && !isNationwide) return { ok: false, error: 'Participating stores need the nationwide switch.' }
    if (listError) return { ok: false, error: listError }
    return { ok: true, fields: { perkScope: 'single_business', isNationwide, businessId, ...list } }
  }

  if (scope !== undefined && !(PERK_SCOPES as readonly unknown[]).includes(scope)) return { ok: false, error: 'perkScope must be single_business or multi_chain.' }
  if (businessId) return { ok: false, error: 'A Multipass perk is not tied to a business.' }
  if (!brandName) return { ok: false, error: 'A Multipass perk needs a brand name.' }
  if (brandName.length > MAX_BRAND_NAME_LENGTH) return { ok: false, error: `The brand name is at most ${MAX_BRAND_NAME_LENGTH} characters.` }
  const perkScope = parsePerkScope(scope)

  if (perkScope === 'single_business') {
    if (hasGuide) return { ok: false, error: 'The redemption guide is for multi-chain perks only.' }
    if (listError) return { ok: false, error: listError }
    return { ok: true, fields: { perkScope, isNationwide: true, brandName, ...list } }
  }

  return parseMultiChain({ businessId, brandName, chains, guide, hasGuide, listError })
}

/** A multi-chain pass, manual (direct) or Multipass: an issuer's name, 1..40 chains, an optional guide, and no business. */
function parseMultiChain({ businessId, brandName, chains, guide, hasGuide, listError }: {
  businessId: string; brandName: string; chains: string[]; guide: { he: string; en: string }; hasGuide: boolean; listError: string | null
}): PerkScopeResult {
  if (businessId) return { ok: false, error: 'A multi-chain pass is not tied to a business.' }
  if (!brandName) return { ok: false, error: 'A multi-chain pass needs a brand name.' }
  if (brandName.length > MAX_BRAND_NAME_LENGTH) return { ok: false, error: `The brand name is at most ${MAX_BRAND_NAME_LENGTH} characters.` }
  if (chains.length === 0) return { ok: false, error: 'A multi-chain perk needs at least one participating chain.' }
  if (listError) return { ok: false, error: listError }
  if (guide.he.length > MAX_GUIDE_LENGTH || guide.en.length > MAX_GUIDE_LENGTH) return { ok: false, error: `The redemption guide is at most ${MAX_GUIDE_LENGTH} characters.` }
  return {
    ok: true,
    fields: { perkScope: 'multi_chain', isNationwide: true, brandName, participatingChains: chains, chainsCount: chains.length, ...(hasGuide ? { universalRedemptionGuide: guide } : {}) },
  }
}

/** The shared limits on a list of participating stores or chains; null when it fits. */
export function chainsError(chains: readonly string[]): string | null {
  if (chains.length > MAX_CHAINS) return `At most ${MAX_CHAINS} stores or chains.`
  if (chains.some((c) => c.length > MAX_CHAIN_NAME_LENGTH)) return `A store or chain name is at most ${MAX_CHAIN_NAME_LENGTH} characters.`
  return null
}

/** What the consumer surfaces read back from a stored offer. */
export interface PerkScopeView {
  perkScope: PerkScope
  isNationwide: boolean
  brandName: string
  participatingChains: string[]
  participatingPlaces: ParticipatingPlace[]
  chainsCount: number
  universalRedemptionGuide: { he: string; en: string } | null
}

export function readPerkScope(data: Record<string, unknown>): PerkScopeView {
  const chains = normalizeChains(data.participatingChains)
  const places = parseParticipatingPlaces(data.participatingPlaces)
  const g = data.universalRedemptionGuide as { he?: unknown; en?: unknown } | undefined
  const guide = g && (clean(g.he) || clean(g.en)) ? { he: clean(g.he), en: clean(g.en) } : null
  return {
    perkScope: parsePerkScope(data.perkScope),
    isNationwide: data.isNationwide === true,
    brandName: clean(data.brandName),
    participatingChains: chains,
    participatingPlaces: places,
    chainsCount: chains.length,
    universalRedemptionGuide: guide,
  }
}

/** A multi-chain, Multipass or nationwide perk has no single place, so distance sorting never applies to it. */
export const hasSinglePlace = (offer: { perkScope?: unknown; fulfillmentType?: unknown; isNationwide?: unknown }) =>
  parsePerkScope(offer.perkScope) !== 'multi_chain' && offer.fulfillmentType !== 'multipass_pool' && offer.isNationwide !== true

/** The scope fields frozen onto a Multipass order and voucher, so a later offer edit never changes what was bought. */
export function frozenPerkScope(offer: Record<string, unknown>): Record<string, unknown> {
  const view = readPerkScope(offer)
  return {
    perkScope: view.perkScope,
    ...(view.isNationwide ? { isNationwide: true } : {}),
    brandName: view.brandName,
    ...(view.participatingChains.length > 0 ? { participatingChains: view.participatingChains, chainsCount: view.chainsCount } : {}),
    ...(view.participatingPlaces.length > 0 ? { participatingPlaces: view.participatingPlaces } : {}),
    ...(view.perkScope === 'multi_chain' && view.universalRedemptionGuide ? { universalRedemptionGuide: view.universalRedemptionGuide } : {}),
  }
}

/** What a nationwide local-business order and voucher freeze: the flag and, when set, the stores that honour it. Nothing for a single-location perk. */
export function frozenNationwide(offer: Record<string, unknown>): Record<string, unknown> {
  const view = readPerkScope(offer)
  if (!view.isNationwide) return {}
  return {
    isNationwide: true,
    ...(view.participatingChains.length > 0 ? { participatingChains: view.participatingChains, chainsCount: view.chainsCount } : {}),
    ...(view.participatingPlaces.length > 0 ? { participatingPlaces: view.participatingPlaces } : {}),
  }
}

/**
 * Whether the perk belongs to one business: a local-business perk that is not a multi-chain pass. A Multipass perk
 * and a manual multi-chain pass carry a brand instead, so they have no merchant to redeem them, pay or settle with.
 */
export const belongsToBusiness = (subject: { fulfillmentType?: unknown; perkScope?: unknown }) =>
  parseFulfillmentType(subject.fulfillmentType) === 'direct_merchant' && parsePerkScope(subject.perkScope) !== 'multi_chain'
