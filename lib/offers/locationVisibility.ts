// Whether a perk shows one street address with Waze / Google Maps buttons, or a branch-validity notice instead.
// One pure rule for the offer page, the voucher page, the cards and Near Me, on the website and in the app.
// An offer and a voucher carry the place under different names (geo / businessGeo, address / businessAddress),
// so both shapes are read here.

import { parseFulfillmentType } from '../inventory/types'
import { parsePerkScope } from './perkScope'

export interface LocationSubject {
  fulfillmentType?: unknown
  perkScope?: unknown
  /** A direct-merchant chain redeemable across its branches: hides the single address. Absent reads as false. */
  isNationwide?: unknown
  geo?: { lat?: unknown; lng?: unknown } | null
  businessGeo?: { lat?: unknown; lng?: unknown } | null
  address?: unknown
  businessAddress?: unknown
  location?: unknown
  /** The stores (or, for a multi-chain voucher, the chains) that honour the perk. */
  participatingChains?: unknown
}

const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const hasCoordinates = (geo: LocationSubject['geo']) => !!geo && isNumber(geo.lat) && isNumber(geo.lng)

function hasAddressText(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0
  if (!value || typeof value !== 'object') return false
  // A place snapshot: { short, formatted, placeId } with a name per language.
  return Object.values(value as Record<string, unknown>).some((part) => (typeof part === 'string' ? part.trim().length > 0 : hasAddressText(part)))
}

/** True when the perk spans several branches, so no single address or navigation applies. */
export function isMultiBranch(subject: LocationSubject): boolean {
  return parseFulfillmentType(subject.fulfillmentType) === 'multipass_pool' || parsePerkScope(subject.perkScope) === 'multi_chain' || subject.isNationwide === true
}

/** Single address and Waze / Google Maps only for a single-location direct perk that actually has a place. */
export function shouldShowLocationNavigation(subject: LocationSubject): boolean {
  if (isMultiBranch(subject)) return false
  return hasCoordinates(subject.geo) || hasCoordinates(subject.businessGeo) || hasAddressText(subject.address) || hasAddressText(subject.businessAddress) || hasAddressText(subject.location)
}

export type LocationNoticeKind = 'chains' | 'stores' | 'nationwide' | 'participating'

const listLength = (subject: LocationSubject) => (Array.isArray(subject.participatingChains) ? subject.participatingChains.filter((n) => typeof n === 'string' && n.trim()).length : 0)

/** Which replacement notice a multi-branch perk shows; null for a single-location perk. */
export function locationNoticeKind(subject: LocationSubject): LocationNoticeKind | null {
  if (parsePerkScope(subject.perkScope) === 'multi_chain') return 'chains'
  if (!isMultiBranch(subject)) return null
  if (listLength(subject) > 0) return 'stores'
  return parseFulfillmentType(subject.fulfillmentType) === 'multipass_pool' ? 'participating' : 'nationwide'
}

/**
 * The notice as translation key and count. A store count of one has its own singular line;
 * the count is wrapped for bidi isolation by the caller (see `withCount`).
 */
export function locationNotice(subject: LocationSubject): { key: LocationNoticeKey; count: number } | null {
  const kind = locationNoticeKind(subject)
  if (!kind) return null
  const count = listLength(subject)
  if (kind === 'chains') return { key: 'perk_honoured_at_chains', count }
  if (kind === 'stores') return { key: count === 1 ? 'perk_valid_one_store' : 'perk_valid_n_stores', count }
  return { key: kind === 'nationwide' ? 'perk_valid_all_stores' : 'perk_valid_participating_stores', count }
}

export type LocationNoticeKey =
  | 'perk_honoured_at_chains'
  | 'perk_valid_one_store'
  | 'perk_valid_n_stores'
  | 'perk_valid_all_stores'
  | 'perk_valid_participating_stores'

/** Fills {n} with the count, isolated so it keeps its order inside a right-to-left line. */
export const withCount = (text: string, count: number) => text.replace('{n}', `\u2066${count}\u2069`)
