import { NextResponse } from 'next/server'
import { WHATSAPP_COMMUNITY_URL } from '@/lib/prelaunch/links'

// The link campaigns use for the WhatsApp community. Mail tools wrap a direct
// chat.whatsapp.com link in their tracking and can break it, so they point here
// and this answers with the clean invite: nothing from the request goes along,
// so a tracker's parameters never reach WhatsApp. Temporary and uncached, so a
// new invite takes effect with the next deploy. No database, so it's the same
// on DEV and PROD.
export const dynamic = 'force-dynamic'

export function GET() {
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: WHATSAPP_COMMUNITY_URL,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
}
