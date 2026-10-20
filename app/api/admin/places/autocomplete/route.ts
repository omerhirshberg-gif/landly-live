import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { autocompleteAddress, isMapsConfigured } from '@/lib/maps/googleMaps'
import { isPlacesSessionToken } from '@/lib/maps/placesSession'

// The admin address field's suggestions (components/admin/AddressAutocomplete.tsx),
// proxied so the Maps key stays on the server. 503 when no key is configured:
// the field then works as plain text.
export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  if (!isMapsConfigured()) return NextResponse.json({ error: 'Address search is not configured.' }, { status: 503 })

  const body = (await request.json().catch(() => null)) as { input?: unknown; sessionToken?: unknown; lang?: unknown } | null
  const input = typeof body?.input === 'string' ? body.input.trim() : ''
  if (input.length < 3 || input.length > 200) return NextResponse.json({ suggestions: [] })
  if (!isPlacesSessionToken(body?.sessionToken)) return NextResponse.json({ error: 'Invalid session token.' }, { status: 400 })

  try {
    const suggestions = await autocompleteAddress(input, body.sessionToken, body?.lang === 'en' ? 'en' : 'he')
    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Places autocomplete failed', error)
    return NextResponse.json({ error: 'Address search is unavailable right now.' }, { status: 502 })
  }
}
