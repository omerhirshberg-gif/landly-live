import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { REPLY_MAX, replyAsTeam, WA_ID } from '@/lib/whatsapp/adminInbox'

// A reply from the team to a WhatsApp member, sent as Landly from the
// support inbox (lib/whatsapp/adminInbox.ts). 409 once Meta's 24-hour
// window has closed; 502 when Meta refuses it (the failed message is still
// returned, and shows in the transcript as failed).
export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const body = (await request.json().catch(() => null)) as { waId?: unknown; message?: unknown } | null
  const waId = typeof body?.waId === 'string' ? body.waId : ''
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!WA_ID.test(waId)) return NextResponse.json({ error: 'Invalid WhatsApp ID.' }, { status: 400 })
  if (!message || message.length > REPLY_MAX) {
    return NextResponse.json({ error: `The message must be 1–${REPLY_MAX} characters.` }, { status: 400 })
  }

  const result = await replyAsTeam(waId, message)
  if (result.ok) return NextResponse.json(result)
  if (result.error === 'not_found') return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
  if (result.error === 'window_closed') {
    return NextResponse.json({ error: 'window_closed', detail: 'More than 24 hours since the member last wrote; WhatsApp only allows template messages now.' }, { status: 409 })
  }
  return NextResponse.json({ error: 'WhatsApp did not accept the message.', code: result.code, message: result.message }, { status: 502 })
}
