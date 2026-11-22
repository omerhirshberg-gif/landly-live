// The Raayonit hub's "Region" filter and the coverage / redemption badges on its venue cards, resolved from data the
// offer already carries (branch cities, the redemption method and modes): no network calls. Pure, shared with Expo.
import { ISRAEL_CITY_COORDS, type RegionId } from '../israelCities'
import { haversineDistanceKm, type Coordinates } from '../geo'
import type { OfferDocument } from '../firebase/offers'
import type { TranslationKey } from '../i18n/translations'
import { localizedBranch } from './branches'
import { offerMatchesSearch } from '../perks/perksFilter'

export const RAAYONIT_REGION_FILTERS = ['all', 'center', 'sharon', 'jerusalem', 'north', 'south', 'nationwide', 'online'] as const
export type RaayonitRegionFilter = (typeof RAAYONIT_REGION_FILTERS)[number]

export const RAAYONIT_REGION_LABEL_KEYS: Record<RaayonitRegionFilter, TranslationKey> = {
  all: 'raayonit_filter_all',
  center: 'raayonit_region_center',
  sharon: 'raayonit_region_sharon',
  jerusalem: 'raayonit_region_jerusalem',
  north: 'raayonit_region_north',
  south: 'raayonit_region_south',
  nationwide: 'raayonit_region_nationwide',
  online: 'raayonit_region_online',
}

// The Gift-Zone pills over the app's six regions: Eilat and the Dead Sea belong to the South.
const REGION_OF_FILTER: Partial<Record<RaayonitRegionFilter, readonly RegionId[]>> = {
  center: ['tlv'],
  sharon: ['sharon'],
  jerusalem: ['jer'],
  north: ['north'],
  south: ['south', 'eilat'],
}

/** The Location filter's "Near me": the region of the known city closest to the member's position (Eilat and the Dead Sea count as South). */
export function regionFilterNear(coords: Coordinates): RaayonitRegionFilter {
  let best: { km: number; region: RegionId } | null = null
  for (const city of Object.values(ISRAEL_CITY_COORDS)) {
    const km = haversineDistanceKm(coords, city)
    if (!best || km < best.km) best = { km, region: city.region }
  }
  if (!best) return 'all'
  return (Object.entries(REGION_OF_FILTER).find(([, regions]) => regions?.includes(best.region))?.[0] as RaayonitRegionFilter | undefined) ?? 'all'
}

/** "Near me" shows venues within this many kilometres of the member. */
export const NEAR_ME_RADIUS_KM = 5

/**
 * How far the closest branch is from `origin`, in km, or null when none can be placed. Branches carry a city, not coordinates, so a branch sits at
 * its city's centre: precise to the city, which is enough for a 5 km circle in the places chains actually are. Online-only venues have no branches.
 */
export function distanceToNearestBranchKm(offer: Pick<Subject, 'branches' | 'city'>, origin: Coordinates): number | null {
  const cities = (offer.branches ?? []).map((b) => b.city?.trim()).filter(Boolean)
  if (cities.length === 0 && offer.city?.he) cities.push(offer.city.he.trim())
  let best: number | null = null
  for (const name of cities) {
    const at = ISRAEL_CITY_COORDS[name as string]
    if (!at) continue
    const km = haversineDistanceKm(origin, at)
    if (best === null || km < best) best = km
  }
  return best
}

/** The venues within the radius, nearest first. */
export function nearMe<T extends Pick<Subject, 'branches' | 'city'>>(offers: readonly T[], origin: Coordinates, radiusKm = NEAR_ME_RADIUS_KM): T[] {
  return offers
    .map((offer) => ({ offer, km: distanceToNearestBranchKm(offer, origin) }))
    .filter((x): x is { offer: T; km: number } => x.km !== null && x.km <= radiusKm)
    .sort((a, b) => a.km - b.km)
    .map((x) => x.offer)
}

/** A chain spread over this many regions or more counts as nationwide, however its branches are listed. */
export const NATIONWIDE_REGION_COUNT = 4

type Subject = Pick<OfferDocument, 'branches' | 'city' | 'isNationwide' | 'redemptionMethod' | 'redemptionModes'>

/** The regions the offer's branches are in. Only cities the app knows are placed: an unknown or missing city adds nothing, so it is never mislabelled. */
export function offerRegions(offer: Pick<Subject, 'branches' | 'city'>): Set<RegionId> {
  const out = new Set<RegionId>()
  for (const branch of offer.branches ?? []) {
    const region = ISRAEL_CITY_COORDS[branch.city?.trim()]?.region
    if (region) out.add(region)
  }
  if (out.size === 0) {
    const region = ISRAEL_CITY_COORDS[offer.city?.he?.trim() ?? '']?.region
    if (region) out.add(region)
  }
  return out
}

export function isOnlineOffer(offer: Pick<Subject, 'redemptionMethod' | 'redemptionModes'>): boolean {
  return offer.redemptionMethod === 'online' || (offer.redemptionModes ?? []).includes('online')
}

export function isNationwideOffer(offer: Pick<Subject, 'branches' | 'city' | 'isNationwide'>): boolean {
  return !!offer.isNationwide || (offer.branches?.length ?? 0) === 0 || offerRegions(offer).size >= NATIONWIDE_REGION_COUNT
}

/** Whether the offer shows under a region pill. `all` keeps everything; a venue with no placeable branch city shows under All and Nationwide only. */
export function matchesRegionFilter(offer: Subject, filter: RaayonitRegionFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'online') return isOnlineOffer(offer)
  if (filter === 'nationwide') return isNationwideOffer(offer)
  const wanted = REGION_OF_FILTER[filter] ?? []
  for (const region of offerRegions(offer)) if (wanted.includes(region)) return true
  return false
}

export type RedemptionBadge = 'online' | 'phone' | 'in_store'

/** The muted redemption badge on a venue card: online, by phone (a booking or phone order), or in the branches only. */
export function redemptionBadge(offer: Pick<Subject, 'redemptionMethod' | 'redemptionModes'>): RedemptionBadge {
  if (offer.redemptionMethod === 'online') return 'online'
  if (offer.redemptionMethod === 'phone_booking' || offer.redemptionMethod === 'advance_booking' || offer.redemptionMethod === 'phone_order') return 'phone'
  return 'in_store'
}

export const REDEMPTION_BADGE_KEYS: Record<RedemptionBadge, TranslationKey> = {
  online: 'raayonit_badge_online',
  phone: 'raayonit_badge_phone',
  in_store: 'raayonit_badge_in_store',
}

/** Which regions have at least one venue, for hiding empty pills. `all` is always there. */
export function availableRegionFilters(offers: readonly Subject[]): RaayonitRegionFilter[] {
  return RAAYONIT_REGION_FILTERS.filter((f) => f === 'all' || offers.some((o) => matchesRegionFilter(o, f)))
}

/** The hub's search: the usual name / title / category match, or a city one of the branches is in (as written, or in the reader's language). */
export function chainMatchesSearch(offer: OfferDocument, normalizedQuery: string, t: (key: TranslationKey) => string, lang: string): boolean {
  if (!normalizedQuery) return true
  if (offerMatchesSearch(offer, normalizedQuery, t, lang)) return true
  return (offer.branches ?? []).some((b) => b.city.toLowerCase().includes(normalizedQuery) || localizedBranch(b, lang).city.toLowerCase().includes(normalizedQuery))
}
