import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { listConversations } from '@/lib/whatsapp/adminInbox'

// The support inbox's conversation list (/admin/support): the most recent
// WhatsApp conversations by the member's last message, newest first. The
// page filters and searches them itself. With ?summary=1, only how many need
// a reply, for the badges on every admin page (lib/admin/needsReply.ts).
export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const conversations = await listConversations()
  if (new URL(request.url).searchParams.get('summary') === '1') {
    return NextResponse.json({ needsReplyCount: conversations.filter((c) => c.needsReply).length })
  }
  return NextResponse.json({ conversations })
}
