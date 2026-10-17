import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { requireCustomer, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { corsHeaders } from '@/lib/auth/cors'
import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'

// "Sign out of all devices" from Privacy & Security (website
// /settings/privacy-security, app settings stack): revokes every refresh
// token of the signed-in customer, so each other device is signed out the
// next time its ID token is refreshed (within the hour) and every API route
// that verifies tokens with checkRevoked refuses it at once. The calling
// device signs itself out after a success. Who is signed out comes from the
// verified ID token only. CORS for the app's Expo web build (lib/auth/cors.ts).
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
    await getAdminAuth().revokeRefreshTokens(decoded.uid)
  } catch (err) {
    console.error('revoke sessions failed', err)
    return json({ error: 'revoke_failed' }, 503)
  }
  return json({ ok: true })
}
