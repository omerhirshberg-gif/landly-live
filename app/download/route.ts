import { NextResponse, type NextRequest } from 'next/server'
import { downloadTarget } from '@/lib/appLinks'

// The landing's one download link and QR code: a phone goes straight to its
// own store (lib/appLinks.ts).
export function GET(request: NextRequest) {
  const target = downloadTarget(request.headers.get('user-agent') ?? '')
  return NextResponse.redirect(new URL(target, request.url), 307)
}
