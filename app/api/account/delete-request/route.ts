import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { requireCustomer, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { corsHeaders } from '@/lib/auth/cors'
import { isDeletionRequestRateLimited, isDeletionRequestUidRateLimited } from '@/lib/auth/contactFormRateLimit'
import { fullName } from '@/lib/auth/names'
import { parseDeletionRequest, sendDeletionRequest } from '@/lib/email/sendDeletionRequest'
import { claimDeletionRequest } from '@/lib/account/deletionRequests'

// The "Delete Account" request from the website's /settings and the app's
// Profile tab: emails the team inbox (Reply-To the member) and records it in
// accountDeletionRequests/{uid}. Signed-in customers only, but not only
// verified ones: an unverified member can still ask to be deleted. Who is
// asking comes from the verified ID token and users/{uid}, never the body. A
// repeat within 24 hours answers ok without emailing again.
// CORS for the app's Expo web build (lib/auth/cors.ts); native apps and the
// website itself don't need it.
export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: Request) {
  const cors = corsHeaders(request)
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: cors })

  const body = await request.json().catch(() => null)
  // Honeypot: a hidden field people never fill. Bots get a fake success.
  if (body && typeof body.website === 'string' && body.website.trim()) return json({ ok: true })
  if (isDeletionRequestRateLimited(request)) return json({ error: 'rate_limited' }, 429)

  let decoded
  try {
    decoded = await requireCustomer(request)
  } catch (err) {
    if (err instanceof RequestAuthError) return json({ error: err.message }, err.status)
    throw err
  }
  if (isDeletionRequestUidRateLimited(decoded.uid)) return json({ error: 'rate_limited' }, 429)

  const parsed = parseDeletionRequest(body)
  const email = decoded.email
  if (!parsed || !email) return json({ error: 'invalid' }, 400)

  const db = getAdminDb()
  let profile: Record<string, unknown> | undefined
  try {
    profile = (await db.collection('users').doc(decoded.uid).get()).data()
  } catch {
    // The token's name is enough for the email.
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const name =
    fullName(str(profile?.firstName), str(profile?.lastName)) || str(profile?.displayName) || str(decoded.name) || '(no name)'
  const requestedAt = new Date()

  let claim
  try {
    claim = await claimDeletionRequest(db, { uid: decoded.uid, email, name, ...parsed, requestedAt, status: 'pending' })
  } catch (err) {
    console.error('account deletion request: record failed', err)
    return json({ error: 'send_failed' }, 503)
  }
  if (claim.status === 'duplicate') return json({ ok: true, duplicate: true })

  try {
    await sendDeletionRequest({
      uid: decoded.uid,
      name,
      email,
      providers: Object.keys(decoded.firebase?.identities ?? {}).filter((p) => p !== 'email'),
      requestedAt,
      ...parsed,
    })
  } catch (err) {
    console.error('account deletion request: send failed', err)
    await claim.rollback().catch(() => {})
    return json({ error: 'send_failed' }, 502)
  }
  return json({ ok: true })
}
