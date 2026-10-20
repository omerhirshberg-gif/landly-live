import 'server-only'
import type { Coordinates, GeoAddress, LocalizedName } from '@/lib/geo'
import { CONTENT_LANGS } from '@/lib/i18n/contentTranslation'
import type { Lang } from '@/lib/i18n/translations'

// Google Maps Platform over REST, server side only: the key
// (GOOGLE_MAPS_SERVER_API_KEY, restricted to Places API (New) and Geocoding
// API) never reaches a browser or the app bundle, and every call is one we
// chose to make. Callers: the admin address field (autocomplete + details,
// admin session required) and the public reverse-geocode proxy (rounded
// coordinates, cached in Firestore for 30 days).
//
// Places bills an autocomplete session (keystrokes + the Details call that
// ends it) as one when they share a session token, so the admin field sends
// one per typing session. Details asks only for Essentials-tier fields, once
// per language we show (the address as Google itself writes it there, so a
// Hebrew street name is never machine-translated); only the first of those
// calls carries the session token.

const PLACES_API = 'https://places.googleapis.com/v1'
const GEOCODE_API = 'https://maps.googleapis.com/maps/api/geocode/json'
const TIMEOUT_MS = 6000
const DETAILS_FIELDS = 'id,formattedAddress,shortFormattedAddress,location,addressComponents'

export class MapsUnavailableError extends Error {}

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim()
  if (!key) throw new MapsUnavailableError('GOOGLE_MAPS_SERVER_API_KEY is not set.')
  return key
}

export function isMapsConfigured(): boolean {
  return !!process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim()
}

async function getJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Google Maps request failed (${res.status}): ${detail.slice(0, 300)}`)
  }
  return (await res.json()) as T
}

export interface PlaceSuggestion {
  placeId: string
  main: string
  secondary: string
}

export async function autocompleteAddress(input: string, sessionToken: string, lang: 'he' | 'en'): Promise<PlaceSuggestion[]> {
  const data = await getJson<{
    suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } } }[]
  }>(`${PLACES_API}/places:autocomplete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey() },
    body: JSON.stringify({ input, sessionToken, languageCode: lang, includedRegionCodes: ['il'] }),
  })
  return (data.suggestions ?? []).flatMap(({ placePrediction: p }) => {
    if (!p?.placeId) return []
    const main = p.structuredFormat?.mainText?.text ?? p.text?.text ?? ''
    return main ? [{ placeId: p.placeId, main, secondary: p.structuredFormat?.secondaryText?.text ?? '' }] : []
  })
}

interface PlaceDetails {
  id?: string
  formattedAddress?: string
  shortFormattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  addressComponents?: { longText?: string; types?: string[] }[]
}

const CITY_TYPES = ['locality', 'postal_town', 'administrative_area_level_2', 'sublocality']

function cityOf(components: { longText?: string; types?: string[] }[] | undefined): string | undefined {
  for (const type of CITY_TYPES) {
    const match = components?.find((component) => component.types?.includes(type))?.longText
    if (match) return match
  }
  return undefined
}

/**
 * The place in all five languages (Essentials lookups, Hebrew first: with a
 * session token, that one closes the autocomplete session). Null when Google
 * has no coordinates for it. Without a token (the admin refresh) each lookup
 * is billed on its own.
 */
export async function placeAddress(placeId: string, sessionToken?: string): Promise<GeoAddress | null> {
  const details = (lang: Lang, token?: string) =>
    getJson<PlaceDetails>(
      `${PLACES_API}/places/${encodeURIComponent(placeId)}?languageCode=${lang}${token ? `&sessionToken=${encodeURIComponent(token)}` : ''}`,
      { headers: { 'X-Goog-Api-Key': apiKey(), 'X-Goog-FieldMask': DETAILS_FIELDS } }
    )
  const langs: Lang[] = ['he', ...CONTENT_LANGS.filter((lang) => lang !== 'he')]
  const results = await Promise.all(langs.map((lang, i) => details(lang, i === 0 ? sessionToken : undefined)))
  const byLang = langs.map((lang, i) => [lang, results[i]!] as const)
  const lat = results.find((place) => typeof place.location?.latitude === 'number')?.location?.latitude
  const lng = results.find((place) => typeof place.location?.longitude === 'number')?.location?.longitude
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  const name = (pick: (place: PlaceDetails) => string | undefined): LocalizedName => {
    const out: LocalizedName = {}
    for (const [lang, place] of byLang) {
      const text = pick(place)?.trim()
      if (text) out[lang] = text
    }
    return out
  }
  return {
    placeId: results.find((place) => place.id)?.id ?? placeId,
    formatted: name((place) => place.formattedAddress),
    short: name((place) => place.shortFormattedAddress),
    city: name((place) => cityOf(place.addressComponents)),
    lat,
    lng,
    fetchedAt: new Date().toISOString(),
  }
}

/** The city at a point, in `lang`, or null when Google names none there. */
export async function reverseGeocodeCity({ lat, lng }: Coordinates, lang: string): Promise<string | null> {
  const data = await getJson<{ status?: string; results?: { address_components?: { long_name?: string; types?: string[] }[] }[] }>(
    `${GEOCODE_API}?latlng=${lat},${lng}&language=${encodeURIComponent(lang)}&result_type=locality|administrative_area_level_2&key=${apiKey()}`,
    {}
  )
  if (data.status === 'ZERO_RESULTS') return null
  if (data.status !== 'OK') throw new Error(`Geocoding status ${data.status}`)
  for (const result of data.results ?? []) {
    const city = cityOf(result.address_components?.map((c) => ({ longText: c.long_name, types: c.types })))
    if (city) return city
  }
  return null
}
