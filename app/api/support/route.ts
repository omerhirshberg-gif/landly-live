import { NextResponse } from 'next/server'
import { parseSupportMessage, sendSupportMessage } from '@/lib/email/sendSupportMessage'
import { isSupportMessageRateLimited } from '@/lib/auth/contactFormRateLimit'

// Receives the /support contact form and emails it to the team inbox
// (SUPPORT_EMAIL) with Reply-To set to the sender.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  // Honeypot: a hidden field real visitors never fill. Bots get a fake success.
  if (body && typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json({ ok: true })
  }

  if (isSupportMessageRateLimited(request)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const message = parseSupportMessage(body)
  if (!message) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  try {
    await sendSupportMessage(message)
  } catch (err) {
    console.error('support message send failed', err)
    return NextResponse.json({ error: 'send_failed' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
