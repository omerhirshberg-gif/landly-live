import { NextResponse } from 'next/server'
import { requireCustomer, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { corsHeaders } from '@/lib/auth/cors'
import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { syncSessionCutoff } from '@/lib/auth/sessionRevocation'

// Called right after a password change (website Security section, app
// ChangePassword): Firebase has just revoked every other session of the
// member, and this copies that cutoff into users/{uid}.sessionsValidAfter so
// Firestore refuses those sessions at once too (lib/auth/sessionRevocation.ts).
// The caller's own token passed checkRevoked, so it is never cut off itself.
// Who is synced comes from the verified ID token only. CORS for the app's
// Expo web build (lib/auth/cors.ts).
export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: Request) {
  const cors = corsHeaders(request)
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: cors })

  let decoded
  try {
    decoded = await requireCustomer(request)
  } catch (err) {
    if (err instanceof RequestAuthError) return json({ error: err.message }, err.status)
    throw err
  }
  if (checkUidRateLimit('sessions', decoded.uid)) return json({ error: 'rate_limited' }, 429)

  try {
    await syncSessionCutoff(decoded.uid)
  } catch (err) {
    console.error('sync sessions failed', err)
    return json({ error: 'sync_failed' }, 503)
  }
  return json({ ok: true })
}
