// Who honours a perk. A local-business perk belongs to one onboarded business (`businessId`).
// A Multipass perk belongs to no business document: it carries a brand's display name, and
// a multi-chain voucher (BUYME All Style and the like) also lists the chains that honour it.
// One pure validator for the admin API, the batch importer and the tests. Shared with Expo.

import type { FulfillmentType } from '../inventory/types'

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
  universalRedemptionGuide?: unknown
}

/** What gets stored on the offer (fields that don't apply are absent). */
export interface PerkScopeFields {
  perkScope: PerkScope
  businessId?: string
  brandName?: string
  participatingChains?: string[]
  chainsCount?: number
  universalRedemptionGuide?: { he: string; en: string }
}

export type PerkScopeResult = { ok: true; fields: PerkScopeFields } | { ok: false; error: string }

export function parsePerkScopeFields(input: PerkScopeInput): PerkScopeResult {
  const businessId = clean(input.businessId)
  const brandName = clean(input.brandName)
  const chains = normalizeChains(input.participatingChains)
  const guideRaw = input.universalRedemptionGuide as { he?: unknown; en?: unknown } | null | undefined
  const guide = { he: clean(guideRaw?.he), en: clean(guideRaw?.en) }
  const hasGuide = !!(guide.he || guide.en)
  const scope = input.perkScope === undefined || input.perkScope === null || input.perkScope === '' ? undefined : input.perkScope

  if (input.fulfillmentType === 'direct_merchant') {
    if (scope !== undefined && scope !== 'single_business') return { ok: false, error: 'A local-business perk is always single-business.' }
    if (!businessId) return { ok: false, error: 'A local-business perk needs a business.' }
    if (brandName || chains.length > 0 || hasGuide) return { ok: false, error: 'brandName, participatingChains and the redemption guide are for Multipass perks only.' }
    return { ok: true, fields: { perkScope: 'single_business', businessId } }
  }

  if (scope !== undefined && !(PERK_SCOPES as readonly unknown[]).includes(scope)) return { ok: false, error: 'perkScope must be single_business or multi_chain.' }
  if (businessId) return { ok: false, error: 'A Multipass perk is not tied to a business.' }
  if (!brandName) return { ok: false, error: 'A Multipass perk needs a brand name.' }
  if (brandName.length > MAX_BRAND_NAME_LENGTH) return { ok: false, error: `The brand name is at most ${MAX_BRAND_NAME_LENGTH} characters.` }
  const perkScope = parsePerkScope(scope)

  if (perkScope === 'single_business') {
    if (chains.length > 0 || hasGuide) return { ok: false, error: 'Participating chains and the redemption guide are for multi-chain perks only.' }
    return { ok: true, fields: { perkScope, brandName } }
  }

  if (chains.length === 0) return { ok: false, error: 'A multi-chain perk needs at least one participating chain.' }
  if (chains.length > MAX_CHAINS) return { ok: false, error: `At most ${MAX_CHAINS} chains.` }
  if (chains.some((c) => c.length > MAX_CHAIN_NAME_LENGTH)) return { ok: false, error: `A chain name is at most ${MAX_CHAIN_NAME_LENGTH} characters.` }
  if (guide.he.length > MAX_GUIDE_LENGTH || guide.en.length > MAX_GUIDE_LENGTH) return { ok: false, error: `The redemption guide is at most ${MAX_GUIDE_LENGTH} characters.` }
  return {
    ok: true,
    fields: { perkScope, brandName, participatingChains: chains, chainsCount: chains.length, ...(hasGuide ? { universalRedemptionGuide: guide } : {}) },
  }
}

/** What the consumer surfaces read back from a stored offer. */
export interface PerkScopeView {
  perkScope: PerkScope
  brandName: string
  participatingChains: string[]
  chainsCount: number
  universalRedemptionGuide: { he: string; en: string } | null
}

export function readPerkScope(data: Record<string, unknown>): PerkScopeView {
  const chains = normalizeChains(data.participatingChains)
  const g = data.universalRedemptionGuide as { he?: unknown; en?: unknown } | undefined
  const guide = g && (clean(g.he) || clean(g.en)) ? { he: clean(g.he), en: clean(g.en) } : null
  return {
    perkScope: parsePerkScope(data.perkScope),
    brandName: clean(data.brandName),
    participatingChains: chains,
    chainsCount: chains.length,
    universalRedemptionGuide: guide,
  }
}

/** A multi-chain perk has no single place, so distance sorting never applies to it. */
export const hasSinglePlace = (offer: { perkScope?: unknown }) => parsePerkScope(offer.perkScope) !== 'multi_chain'

/** The scope fields frozen onto a Multipass order and voucher, so a later offer edit never changes what was bought. */
export function frozenPerkScope(offer: Record<string, unknown>): Record<string, unknown> {
  const view = readPerkScope(offer)
  return {
    perkScope: view.perkScope,
    brandName: view.brandName,
    ...(view.perkScope === 'multi_chain'
      ? { participatingChains: view.participatingChains, chainsCount: view.chainsCount, ...(view.universalRedemptionGuide ? { universalRedemptionGuide: view.universalRedemptionGuide } : {}) }
      : {}),
  }
}
