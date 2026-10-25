import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { getConversation, WA_ID } from '@/lib/whatsapp/adminInbox'

// One WhatsApp conversation and its transcript, for the support inbox's chat pane.
export async function GET(request: Request, { params }: { params: Promise<{ waId: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const { waId } = await params
  if (!WA_ID.test(waId)) return NextResponse.json({ error: 'Invalid WhatsApp ID.' }, { status: 400 })
  const result = await getConversation(waId)
  if (!result) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
  return NextResponse.json(result)
}
