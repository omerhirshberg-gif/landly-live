import { offerFromWire, type OfferDocument } from './offerDocument'

// The browser/app side of GET /api/public/offers (app/api/public/offers/route.ts):
// one CDN-cached read of the live offers instead of every client scanning the
// collection. The website calls it same-origin; the Expo app sets its API origin
// once at startup (landly-mobile/src/app/_layout.tsx).
let apiBase = ''
export function setOffersApiBase(base: string) {
  apiBase = base.replace(/\/+$/, '')
}

export const OFFERS_API_TIMEOUT_MS = 8000

/** Throws on a bad answer or no answer, so the caller can fall back to Firestore. */
export async function fetchOffersFromApi(fetchImpl: typeof fetch = fetch): Promise<OfferDocument[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OFFERS_API_TIMEOUT_MS)
  try {
    const res = await fetchImpl(`${apiBase}/api/public/offers`, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`offers api ${res.status}`)
    const body = (await res.json()) as { offers?: unknown }
    if (!Array.isArray(body.offers)) throw new Error('offers api: bad payload')
    return body.offers.map(offerFromWire).filter((offer): offer is OfferDocument => offer !== null)
  } finally {
    clearTimeout(timer)
  }
}
