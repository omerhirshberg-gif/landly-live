import { NextResponse } from 'next/server'
import { appleAppSiteAssociation } from '@/lib/universalLinks'

// iOS universal links (lib/universalLinks.ts). Plain JSON with no extension, never redirected.
export const dynamic = 'force-dynamic'

export function GET() {
  const body = appleAppSiteAssociation(process.env.APPLE_TEAM_ID)
  if (!body) return new NextResponse(null, { status: 404 })
  return NextResponse.json(body, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
