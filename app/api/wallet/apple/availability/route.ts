import { NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/auth/cors'
import { getPassConfig } from '@/lib/wallet/passConfig'

// Whether this deployment can issue passes. Server-driven because an installed
// app outlives any deploy: the badge shows only on a `true`. Public, and says
// nothing about the setup beyond that.
const METHODS = 'GET, OPTIONS'

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request, METHODS) })
}

export function GET(request: Request) {
  const { mode } = getPassConfig()
  return NextResponse.json({ available: mode !== 'unavailable' }, {
    headers: { ...corsHeaders(request, METHODS), 'Cache-Control': 'no-store' },
  })
}
