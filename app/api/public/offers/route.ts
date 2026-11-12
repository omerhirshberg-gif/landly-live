import { NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/auth/cors'
import { getCachedPublicOffers } from '@/lib/firebase/offersCache.server'

// The public offer list, shared by the website and the app. Offers are already
// world-readable (firestore.rules), so this reveals nothing new; it just moves
// the read behind the CDN: s-maxage=60 with a five-minute stale-while-revalidate.
// An admin change drops the server copy at once (revalidatePublicOffers); the
// CDN copy follows within the minute. Fails soft: clients fall back to Firestore.
const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300'

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request, 'GET, OPTIONS') })
}

export async function GET(request: Request) {
  const cors = corsHeaders(request, 'GET, OPTIONS')
  try {
    const offers = await getCachedPublicOffers()
    return NextResponse.json({ offers }, { headers: { ...cors, 'Cache-Control': CACHE_CONTROL } })
  } catch {
    return NextResponse.json({ error: 'Offers are unavailable.' }, { status: 503, headers: { ...cors, 'Cache-Control': 'no-store' } })
  }
}
