import { NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/auth/cors'
import { getGoogleWalletConfig } from '@/lib/wallet/passConfig'

// Whether this deployment can issue Google Wallet passes (the issuer id, the service
// account of its own project and a usable key). Public, and says nothing about the setup
// beyond that; the badge shows only on a `true`.
const METHODS = 'GET, OPTIONS'

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request, METHODS) })
}

export function GET(request: Request) {
  return NextResponse.json({ available: getGoogleWalletConfig().mode === 'ready' }, {
    headers: { ...corsHeaders(request, METHODS), 'Cache-Control': 'no-store' },
  })
}
