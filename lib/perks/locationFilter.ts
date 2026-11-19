// The location filter on Home and Perks: "Near me" within 5 / 15 / 25 km of the member's position, or a region or city picked by
// hand. An offer is placed by its closest branch (the branches' cities, or its own address), so a chain with a branch nearby
// shows up with that branch's distance. A multi-chain pass belongs to no place and always stays. Pure; shared with the Expo app.
import { ISRAEL_CITY_COORDS, type RegionId } from '../israelCities'
import { haversineDistanceKm, type Coordinates } from '../geo'
import type { OfferDocument } from '../firebase/offers'

export const RADII_KM = [5, 15, 25] as const
export type RadiusKm = (typeof RADII_KM)[number]
export const DEFAULT_RADIUS_KM: RadiusKm = 5
/** How near a branch's city must be to a picked city to count as in it, and to any city of a picked region. */
const AREA_REACH_KM = 7

export type LocationFilter =
  | { kind: 'gps'; coords: Coordinates; radiusKm: RadiusKm }
  | { kind: 'area'; region: RegionId | null; city: string | null }

type Placed = Pick<OfferDocument, 'geo' | 'perkScope' | 'branches'>

/** Everywhere the offer can be redeemed that we can place: its own address and each branch's city. */
export function offerPoints(offer: Placed): Coordinates[] {
  const points: Coordinates[] = []
  if (offer.geo) points.push(offer.geo)
  const seen = new Set<string>()
  for (const b of offer.branches ?? []) {
    const c = b.city ? ISRAEL_CITY_COORDS[b.city] : undefined
    if (c && !seen.has(b.city)) { seen.add(b.city); points.push({ lat: c.lat, lng: c.lng }) }
  }
  return points
}

/** Kilometres to the closest place the offer works at, or null when it can't be placed (or is a multi-chain pass). */
export function closestKm(offer: Placed, origin: Coordinates): number | null {
  if (offer.perkScope === 'multi_chain') return null
  const km = offerPoints(offer).map((p) => haversineDistanceKm(origin, p))
  return km.length ? Math.min(...km) : null
}

/** Where an area filter looks: the picked city's centre, or every city of the picked region. */
export function areaCenters(filter: Extract<LocationFilter, { kind: 'area' }>): Coordinates[] {
  if (filter.city) { const c = ISRAEL_CITY_COORDS[filter.city]; return c ? [{ lat: c.lat, lng: c.lng }] : [] }
  return Object.values(ISRAEL_CITY_COORDS).filter((c) => c.region === filter.region).map((c) => ({ lat: c.lat, lng: c.lng }))
}

export function matchesLocation(offer: Placed, filter: LocationFilter): boolean {
  if (offer.perkScope === 'multi_chain') return true
  if (filter.kind === 'gps') {
    const km = closestKm(offer, filter.coords)
    return km !== null && km <= filter.radiusKm
  }
  const centers = areaCenters(filter)
  return offerPoints(offer).some((p) => centers.some((c) => haversineDistanceKm(c, p) <= AREA_REACH_KM))
}

export function applyLocationFilter<T extends Placed>(offers: readonly T[], filter: LocationFilter | null): T[] {
  return filter ? offers.filter((o) => matchesLocation(o, filter)) : [...offers]
}

/** Nearest first for a position filter (offers that can't be placed keep their order, after); unchanged for an area. */
export function sortByLocation<T extends Placed>(offers: readonly T[], filter: LocationFilter | null): T[] {
  if (!filter || filter.kind !== 'gps') return [...offers]
  return offers
    .map((offer, index) => ({ offer, index, km: closestKm(offer, filter.coords) }))
    .sort((a, b) => (a.km === null ? 1 : 0) - (b.km === null ? 1 : 0) || (a.km ?? 0) - (b.km ?? 0) || a.index - b.index)
    .map((x) => x.offer)
}

/** The distance badge: only for a position filter, and never closer than 1 km for a city-level placement. */
export function badgeKm(offer: Placed, filter: LocationFilter | null): number | null {
  if (!filter || filter.kind !== 'gps') return null
  const km = closestKm(offer, filter.coords)
  if (km === null) return null
  return offer.geo ? km : Math.max(km, 1)
}
