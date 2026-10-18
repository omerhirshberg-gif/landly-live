import { NextResponse } from 'next/server'
import { mentorReplyEmail, parseMentorRequest, sendMentorRequest } from '@/lib/email/sendMentorRequest'
import { isMentorRequestRateLimited, isMentorRequestUidRateLimited } from '@/lib/auth/contactFormRateLimit'
import { requireCustomer, RequestAuthError } from '@/lib/firebase/verifyRequestUser'

// Receives the /olim "Connect with a Personal Mentor" form and emails it to
// the team inbox (SUPPORT_EMAIL) with Reply-To set to the member. Signed-in
// customers only (verified email not required), so guests see the sign-up
// gate instead; who is asking comes from the verified ID token, never the
// body. Same honeypot and IP throttle as /api/support, plus a per-account cap.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  // Honeypot: a hidden field real visitors never fill. Bots get a fake success.
  if (body && typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json({ ok: true })
  }

  if (isMentorRequestRateLimited(request)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let decoded
  try {
    decoded = await requireCustomer(request)
  } catch (err) {
    if (err instanceof RequestAuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }
  if (isMentorRequestUidRateLimited(decoded.uid)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const fields = parseMentorRequest(body)
  const email = mentorReplyEmail(decoded.email)
  if (!fields || !email) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  try {
    await sendMentorRequest({ ...fields, uid: decoded.uid, email })
  } catch (err) {
    console.error('mentor request send failed', err)
    return NextResponse.json({ error: 'send_failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
