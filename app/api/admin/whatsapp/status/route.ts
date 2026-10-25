import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { isAdminStatus, setConversationStatus, WA_ID } from '@/lib/whatsapp/adminInbox'

// Sets a WhatsApp conversation's status from the support inbox: resolved
// (with the member's sign-off unless notify is false), escalated (the bot
// stays quiet) or active (back to the bot).
export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const body = (await request.json().catch(() => null)) as { waId?: unknown; status?: unknown; notify?: unknown } | null
  const waId = typeof body?.waId === 'string' ? body.waId : ''
  if (!WA_ID.test(waId)) return NextResponse.json({ error: 'Invalid WhatsApp ID.' }, { status: 400 })
  if (!isAdminStatus(body?.status)) return NextResponse.json({ error: 'Status must be active, escalated or resolved.' }, { status: 400 })

  const result = await setConversationStatus(waId, body.status, body.notify !== false)
  if (!result.ok) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
  return NextResponse.json(result)
}
