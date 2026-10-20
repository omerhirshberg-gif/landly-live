import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { isMapsConfigured, placeAddress } from '@/lib/maps/googleMaps'
import { isPlacesSessionToken } from '@/lib/maps/placesSession'

// The picked suggestion as a GeoAddress (address, short address and city in
// all five languages, coordinates); it ends the autocomplete session.
export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  if (!isMapsConfigured()) return NextResponse.json({ error: 'Address search is not configured.' }, { status: 503 })

  const body = (await request.json().catch(() => null)) as { placeId?: unknown; sessionToken?: unknown } | null
  const placeId = typeof body?.placeId === 'string' ? body.placeId.trim() : ''
  if (!placeId || placeId.length > 512 || !/^[\w-]+$/.test(placeId)) return NextResponse.json({ error: 'Invalid place.' }, { status: 400 })
  if (!isPlacesSessionToken(body?.sessionToken)) return NextResponse.json({ error: 'Invalid session token.' }, { status: 400 })

  try {
    const address = await placeAddress(placeId, body.sessionToken)
    if (!address) return NextResponse.json({ error: 'That place has no map location. Pick another result.' }, { status: 422 })
    return NextResponse.json({ address })
  } catch (error) {
    console.error('Place details failed', error)
    return NextResponse.json({ error: 'Address search is unavailable right now.' }, { status: 502 })
  }
}
