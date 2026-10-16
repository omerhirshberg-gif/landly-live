import { NextResponse } from 'next/server'
import { parseMentorRequest, sendMentorRequest } from '@/lib/email/sendMentorRequest'
import { isMentorRequestRateLimited } from '@/lib/auth/contactFormRateLimit'

// Receives the /olim "Connect with a Personal Mentor" form and emails it to
// the team inbox (SUPPORT_EMAIL) with Reply-To set to the member. Same
// defences as /api/support.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  // Honeypot: a hidden field real visitors never fill. Bots get a fake success.
  if (body && typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json({ ok: true })
  }

  if (isMentorRequestRateLimited(request)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const mentorRequest = parseMentorRequest(body)
  if (!mentorRequest) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  try {
    await sendMentorRequest(mentorRequest)
  } catch (err) {
    console.error('mentor request send failed', err)
    return NextResponse.json({ error: 'send_failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
