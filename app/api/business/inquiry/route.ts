import { NextResponse } from 'next/server'
import { parseBusinessInquiry, sendBusinessInquiry } from '@/lib/email/sendBusinessInquiry'
import { isBusinessInquiryRateLimited } from '@/lib/auth/contactFormRateLimit'

// Public (unauthenticated, unlike the rest of /api/business/*): receives the
// /business partner application and emails it to the team inbox
// (SUPPORT_EMAIL) with Reply-To set to the lead. Same defences as /api/support.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  // Honeypot: a hidden field real visitors never fill. Bots get a fake success.
  if (body && typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json({ ok: true })
  }

  if (isBusinessInquiryRateLimited(request)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const lead = parseBusinessInquiry(body)
  if (!lead) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  try {
    await sendBusinessInquiry(lead)
  } catch (err) {
    console.error('business inquiry send failed', err)
    return NextResponse.json({ error: 'send_failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
