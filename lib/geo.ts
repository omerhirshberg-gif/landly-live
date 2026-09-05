export interface Coordinates {
  lat: number
  lng: number
}

const EARTH_RADIUS_KM = 6371

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Great-circle distance between two points, in kilometers. */
export function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/** Sorts items with a location nearest-first; items without one are dropped. */
export function sortByDistance<T extends { location?: Coordinates }>(items: T[], origin: Coordinates): T[] {
  return items
    .filter((item): item is T & { location: Coordinates } => !!item.location)
    .sort((a, b) => haversineDistanceKm(origin, a.location) - haversineDistanceKm(origin, b.location))
}

export interface PlaceName {
  city: string
  state: string
}

/**
 * Reverse-geocodes coordinates to a city/state via OpenStreetMap's free
 * Nominatim API (no key required). Nominatim's usage policy caps this to
 * low-volume, non-bulk lookups — fine for one "Near Me" click, but a
 * higher-traffic deployment should move this behind a paid provider or a
 * backend proxy instead of calling it directly from the browser.
 */
export async function reverseGeocode(coords: Coordinates): Promise<PlaceName | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&zoom=10&addressdetails=1`,
      { headers: { Accept: 'application/json' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const address = data?.address ?? {}
    const city: string = address.city || address.town || address.village || address.municipality || ''
    const state: string = address.state || address.region || ''
    if (!city && !state) return null
    return { city, state }
  } catch {
    return null
  }
}
