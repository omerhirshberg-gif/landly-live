import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { corsHeaders } from '@/lib/auth/cors'
import { createIpRateLimiter } from '@/lib/maps/reverseGeocodeLimit'
import { getAdminDb } from '@/lib/firebase/admin'
import { roundCoordinates } from '@/lib/geo'
import { isMapsConfigured, reverseGeocodeCity } from '@/lib/maps/googleMaps'
import { CONTENT_LANGS } from '@/lib/i18n/contentTranslation'

// The city under the Perks page's Nearby heading ("Perks near Tel Aviv"), for
// the website and the app. Coordinates arrive already rounded to ~1 km
// (lib/geo.ts reverseGeocode) and are rounded again here, so the cache key is
// coarse and nobody's exact position is ever logged or stored. Answers are
// cached in Firestore (geoCache, server-only by firestore.rules) for 30 days
// and at the CDN for a day, so a city costs one Geocoding call a month per
// language however many members stand in it. Configure a TTL policy on
// geoCache.expiresAt to have Firestore delete old entries
// (docs/google-cloud-configuration.md).

const CACHE_DAYS = 30
const isRateLimited = createIpRateLimiter(30)

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request, 'GET, OPTIONS') })
}

export async function GET(request: Request) {
  const headers = corsHeaders(request, 'GET, OPTIONS')
  const params = new URL(request.url).searchParams
  const lat = Number(params.get('lat'))
  const lng = Number(params.get('lng'))
  const lang = params.get('lang') ?? 'en'
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !(CONTENT_LANGS as readonly string[]).includes(lang)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers })
  }
  const point = roundCoordinates({ lat, lng })
  const key = `${point.lat.toFixed(2)}_${point.lng.toFixed(2)}_${lang}`
  const cacheHeaders = { ...headers, 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' }

  const cacheRef = getAdminDb().collection('geoCache').doc(key)
  const cached = await cacheRef.get().catch(() => null)
  const expiresAt = cached?.data()?.expiresAt
  if (cached?.exists && expiresAt instanceof Timestamp && expiresAt.toMillis() > Date.now()) {
    return NextResponse.json({ city: cached.data()?.city ?? null }, { headers: cacheHeaders })
  }

  if (!isMapsConfigured()) return NextResponse.json({ city: null }, { headers })
  if (isRateLimited(request)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429, headers })
  try {
    const city = await reverseGeocodeCity(point, lang)
    await cacheRef.set({ city, expiresAt: Timestamp.fromMillis(Date.now() + CACHE_DAYS * 86_400_000) }).catch(() => {})
    return NextResponse.json({ city }, { headers: cacheHeaders })
  } catch (error) {
    console.error('Reverse geocoding failed', error)
    return NextResponse.json({ city: null }, { status: 502, headers })
  }
}
