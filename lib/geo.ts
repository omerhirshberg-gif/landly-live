import { CONTENT_LANGS } from './i18n/contentTranslation'
import type { Lang } from './i18n/translations'

// Locations, shared by the website and the Expo app (pure, plus one fetch):
// distances for "Near me", a business's geocoded address, the areas a member
// can pick when location is off, and the city name under the Nearby heading.

export interface Coordinates {
  lat: number
  lng: number
}

/** A place name or address in each of our languages, as Google returns it for each. */
export type LocalizedName = Partial<Record<Lang, string>>

/**
 * A business's address as picked from Places autocomplete in the admin
 * (businesses/{uid}.address), in all five languages from Google itself, never
 * machine-translated. Its coordinates and city are copied onto the business's
 * offers as `geo` and `city`, and its address lines as `address`.
 */
export interface GeoAddress {
  placeId: string
  /** The full address ("Dizengoff St 50, Tel Aviv-Yafo, Israel"), for the offer page. */
  formatted: LocalizedName
  /** Street and city only ("Dizengoff St 50, Tel Aviv-Yafo"), for cards; {} for addresses picked before it existed. */
  short: LocalizedName
  city: LocalizedName
  lat: number
  lng: number
  /** When Google was last asked (ISO 8601): the admin refresh re-fetches older ones. Absent on old picks. */
  fetchedAt?: string
}

/** The address lines an offer (and its orders and vouchers) copies from its business. */
export interface PlaceSnapshot {
  placeId: string
  formatted: LocalizedName
  short: LocalizedName
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

/** Items that have coordinates, nearest first; items without are dropped. */
export function sortByDistance<T>(items: readonly T[], origin: Coordinates, coordsOf: (item: T) => Coordinates | null | undefined): T[] {
  return items
    .map((item) => ({ item, coords: coordsOf(item) }))
    .filter((entry): entry is { item: T; coords: Coordinates } => !!entry.coords)
    .map(({ item, coords }) => ({ item, distance: haversineDistanceKm(origin, coords) }))
    .sort((a, b) => a.distance - b.distance)
    .map(({ item }) => item)
}

const isLatitude = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 90
const isLongitude = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 180

export function parseCoordinates(raw: unknown): Coordinates | null {
  if (!raw || typeof raw !== 'object') return null
  const { lat, lng } = raw as { lat?: unknown; lng?: unknown }
  return isLatitude(lat) && isLongitude(lng) ? { lat, lng } : null
}

const MAX_NAME_LENGTH = 200

export function parseLocalizedName(raw: unknown): LocalizedName {
  if (!raw || typeof raw !== 'object') return {}
  const name: LocalizedName = {}
  for (const key of CONTENT_LANGS) {
    const value = (raw as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim()) name[key] = value.trim().slice(0, MAX_NAME_LENGTH)
  }
  return name
}

/** A stored (or admin-submitted) address, or null when it isn't a usable one. */
export function parseGeoAddress(raw: unknown): GeoAddress | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const coords = parseCoordinates(data)
  const placeId = typeof data.placeId === 'string' ? data.placeId.trim() : ''
  if (!coords || !placeId || placeId.length > 512) return null
  const formatted = parseLocalizedName(data.formatted)
  if (Object.keys(formatted).length === 0) return null
  const fetchedAt = typeof data.fetchedAt === 'string' && !Number.isNaN(Date.parse(data.fetchedAt)) ? data.fetchedAt : undefined
  return {
    placeId,
    formatted,
    short: parseLocalizedName(data.short),
    city: parseLocalizedName(data.city),
    ...coords,
    ...(fetchedAt ? { fetchedAt } : {}),
  }
}

/** An offer's (order's, voucher's) copy of its business's address lines, or null. */
export function parsePlaceSnapshot(raw: unknown): PlaceSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const placeId = typeof data.placeId === 'string' ? data.placeId.trim() : ''
  const formatted = parseLocalizedName(data.formatted)
  if (!placeId || placeId.length > 512 || Object.keys(formatted).length === 0) return null
  return { placeId, formatted, short: parseLocalizedName(data.short) }
}

/** The name in the reader's language, else English, else Hebrew, else whichever exists. */
export function localizedName(name: LocalizedName | null | undefined, lang: Lang): string {
  if (!name) return ''
  return name[lang] || name.en || name.he || Object.values(name).find(Boolean) || ''
}

/**
 * Coordinates rounded to `decimals` places (2 ≈ 1.1 km). The reverse-geocode
 * proxy only ever sees, and caches by, the rounded point: a city name needs
 * no more precision, and the member's exact position never leaves the device.
 */
export function roundCoordinates({ lat, lng }: Coordinates, decimals = 2): Coordinates {
  const factor = 10 ** decimals
  return { lat: Math.round(lat * factor) / factor, lng: Math.round(lng * factor) / factor }
}

/** "350 m", "1.2 km", "14 km", in the reader's language and digits. */
export function formatDistance(km: number, lang: Lang): string {
  const meters = km < 1
  const value = meters ? Math.max(50, Math.round((km * 1000) / 50) * 50) : km < 10 ? Math.round(km * 10) / 10 : Math.round(km)
  try {
    return new Intl.NumberFormat(lang, {
      style: 'unit',
      unit: meters ? 'meter' : 'kilometer',
      unitDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(value)
  } catch {
    // An engine without unit formatting (older Hermes builds).
    return `${value} ${meters ? 'm' : 'km'}`
  }
}

/** A city with perks in it, for the "Choose area" picker when location is off. */
export interface Area {
  key: string
  name: LocalizedName
  center: Coordinates
  count: number
}

/**
 * The cities the given offers are in, most perks first: each city's center is
 * the average of its offers' coordinates. Offers with no coordinates or city
 * (online-only perks, businesses not geocoded yet) are left out.
 */
export function deriveAreas(items: readonly { geo?: Coordinates | null; city?: LocalizedName }[]): Area[] {
  const byKey = new Map<string, { name: LocalizedName; lat: number; lng: number; count: number }>()
  for (const item of items) {
    const key = (item.city?.en || item.city?.he || '').trim().toLowerCase()
    if (!item.geo || !key) continue
    const area = byKey.get(key)
    if (area) {
      area.lat += item.geo.lat
      area.lng += item.geo.lng
      area.count += 1
      for (const lang of CONTENT_LANGS) area.name[lang] ||= item.city?.[lang]
    } else {
      byKey.set(key, { name: { ...item.city }, lat: item.geo.lat, lng: item.geo.lng, count: 1 })
    }
  }
  return Array.from(byKey, ([key, area]) => ({
    key,
    name: area.name,
    center: { lat: area.lat / area.count, lng: area.lng / area.count },
    count: area.count,
  })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

/**
 * The city at a point, in the reader's language, through our cached
 * Geocoding proxy (app/api/geo/reverse). `apiBase` is '' on the website and
 * the deployed site's origin in the app. Null whenever there's no answer:
 * the Nearby heading then just leaves the place out.
 */
export async function reverseGeocode(coords: Coordinates, lang: Lang, apiBase = ''): Promise<string | null> {
  const { lat, lng } = roundCoordinates(coords)
  try {
    const res = await fetch(`${apiBase}/api/geo/reverse?lat=${lat}&lng=${lng}&lang=${lang}`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = (await res.json()) as { city?: unknown }
    return typeof data.city === 'string' && data.city ? data.city : null
  } catch {
    return null
  }
}

/**
 * What an offer copies from its business's document: the display address,
 * and, once the business is geocoded, its coordinates and city (so "Near me"
 * can sort the one offers fetch without reading businesses, which members
 * can't).
 */
export function offerPlaceFields(business: { location?: unknown; address?: unknown }): {
  location: string
  geo: Coordinates | null
  city: LocalizedName
  address: PlaceSnapshot | null
} {
  const address = parseGeoAddress(business.address)
  return {
    location: typeof business.location === 'string' ? business.location : '',
    geo: address ? { lat: address.lat, lng: address.lng } : null,
    city: address?.city ?? {},
    address: address ? { placeId: address.placeId, formatted: address.formatted, short: address.short } : null,
  }
}

interface OfferPlace {
  location?: string
  city?: LocalizedName
  address?: PlaceSnapshot | null
}

/**
 * Where an offer is, for a card: the street and city in the reader's
 * language, as Google writes it there. Offers whose business was picked
 * before short addresses existed fall back to the old rule: Hebrew readers
 * get the address the admin picked, everyone else the city.
 */
export function offerPlaceLabel(offer: OfferPlace, lang: Lang): string {
  const short = localizedName(offer.address?.short, lang)
  if (short) return short
  if (lang === 'he') return offer.location || offer.city?.he || offer.city?.en || ''
  return localizedName(offer.city, lang) || offer.location || ''
}

/** Where an offer is, for its own page: the full address in the reader's language, else the card's label. */
export function offerFullAddress(offer: OfferPlace, lang: Lang): string {
  return localizedName(offer.address?.formatted, lang) || offerPlaceLabel(offer, lang)
}

/** Addresses fetched longer ago than this are fetched again by the admin refresh. */
export const ADDRESS_REFRESH_DAYS = 30

/** Whether a stored address should be fetched from Google again: a language missing, no short form, or old. */
export function isAddressStale(address: GeoAddress, now = Date.now()): boolean {
  if (CONTENT_LANGS.some((lang) => !address.formatted[lang])) return true
  if (Object.keys(address.short).length === 0) return true
  if (!address.fetchedAt) return true
  return now - Date.parse(address.fetchedAt) > ADDRESS_REFRESH_DAYS * 24 * 60 * 60 * 1000
}
