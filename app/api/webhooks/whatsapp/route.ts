import { after, NextResponse } from 'next/server'
import { verifyMetaSignature, verifyTokenMatches } from '@/lib/whatsapp/signature'
import { handleInboundEvents } from '@/lib/whatsapp/supportBotHandler'
import { parseWebhookPayload } from '@/lib/whatsapp/webhookPayload'

// Meta WhatsApp Cloud API webhook for the support line (subscribe the app to
// the "messages" field in the Meta developer dashboard, callback URL
// {APP_URL}/api/webhooks/whatsapp).
//
// GET: the subscription handshake -- echoes hub.challenge when
// hub.verify_token matches WHATSAPP_VERIFY_TOKEN.
// POST: incoming messages, signed with the app secret (x-hub-signature-256,
// checked against WHATSAPP_APP_SECRET over the raw body; fail-closed when it
// isn't set). Meta gets its 200 at once and the bot answers in after()
// (lib/whatsapp/supportBotHandler.ts), so a slow send never triggers retries.

const CHALLENGE = /^[A-Za-z0-9_-]{1,256}$/

export function GET(request: Request) {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN
  if (!expected) {
    console.error('[whatsapp-webhook] WHATSAPP_VERIFY_TOKEN is not configured')
    return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  }
  const params = new URL(request.url).searchParams
  const challenge = params.get('hub.challenge')
  if (params.get('hub.mode') !== 'subscribe' || !verifyTokenMatches(params.get('hub.verify_token'), expected) || !challenge || !CHALLENGE.test(challenge)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' } })
}

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) {
    console.error('[whatsapp-webhook] WHATSAPP_APP_SECRET is not configured; refusing unsigned deliveries')
    return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  }
  const raw = Buffer.from(await request.arrayBuffer())
  if (!verifyMetaSignature(raw, request.headers.get('x-hub-signature-256'), secret)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
  }
  let body: unknown
  try {
    body = JSON.parse(raw.toString('utf8'))
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  const events = parseWebhookPayload(body, process.env.WHATSAPP_PHONE_NUMBER_ID)
  if (events.length) after(() => handleInboundEvents(events))
  return NextResponse.json({ ok: true })
}
