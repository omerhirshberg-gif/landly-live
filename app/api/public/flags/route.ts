import { NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/auth/cors'
import { isRaayonitDisplayEnabled } from '@/lib/flags/featureFlags.server'

// The display flags the website and the app read, so a wallet card, an email-less screen or a pass preview can choose between
// Raayonit's attribution and the neutral multi-chain label. Public by design (a boolean); the server also gates the data itself.
export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request, 'GET, OPTIONS') })
}

export async function GET(request: Request) {
  const cors = corsHeaders(request, 'GET, OPTIONS')
  try {
    return NextResponse.json({ raayonitDisplay: await isRaayonitDisplayEnabled() }, { headers: { ...cors, 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } })
  } catch {
    // An unreadable flag leaves the default (on), the same as the server's own resolution.
    return NextResponse.json({ raayonitDisplay: true }, { headers: { ...cors, 'Cache-Control': 'no-store' } })
  }
}
