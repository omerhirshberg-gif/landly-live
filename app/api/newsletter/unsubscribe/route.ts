import { NextResponse } from 'next/server'
import { clientIp } from '@/lib/auth/clientIp'
import { isDurablyLimited } from '@/lib/auth/durableRateLimit.server'
import { applyUnsubscribe } from '@/lib/newsletter/applyUnsubscribe.server'
import { verifyUnsubscribeToken } from '@/lib/newsletter/unsubscribeToken'

// One-click unsubscribe (RFC 8058). Mail clients POST here from the
// List-Unsubscribe header, and the /unsubscribe page POSTs here when the
// reader confirms. GET never changes anything (mail scanners prefetch links);
// it sends the reader to the confirmation page.
const NO_STORE = { 'Cache-Control': 'no-store' }

function tokenOf(request: Request): string | null {
  return new URL(request.url).searchParams.get('token')
}

export async function GET(request: Request) {
  const token = tokenOf(request)
  const target = new URL('/unsubscribe', request.url)
  if (token) target.searchParams.set('token', token)
  return NextResponse.redirect(target, 303)
}

export async function POST(request: Request) {
  let token = tokenOf(request)
  if (!token) {
    // The page sends it as a form or JSON body instead of in the URL.
    try {
      const type = request.headers.get('content-type') ?? ''
      if (type.includes('application/json')) token = (await request.json())?.token ?? null
      else token = (await request.formData()).get('token')?.toString() ?? null
    } catch {
      token = null
    }
  }
  let email: string | null = null
  try {
    email = verifyUnsubscribeToken(token)
  } catch (err) {
    console.error('[newsletter] unsubscribe secret missing', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE })
  }
  if (!email) return NextResponse.json({ error: 'invalid_token' }, { status: 400, headers: NO_STORE })
  if (await isDurablyLimited({ scope: 'newsletter-unsub', key: clientIp(request), max: 30, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: NO_STORE })
  }
  try {
    await applyUnsubscribe(email)
  } catch (err) {
    console.error('[newsletter] unsubscribe failed', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'failed' }, { status: 500, headers: NO_STORE })
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
