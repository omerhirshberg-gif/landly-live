import { NextResponse } from 'next/server'
import { assetLinks } from '@/lib/universalLinks'

// Android App Links (lib/universalLinks.ts).
export const dynamic = 'force-dynamic'

export function GET() {
  const body = assetLinks(process.env.ANDROID_SHA256_CERT_FINGERPRINTS)
  if (!body) return new NextResponse(null, { status: 404 })
  return NextResponse.json(body, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
