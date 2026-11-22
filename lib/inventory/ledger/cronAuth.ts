import 'server-only'
import { NextResponse } from 'next/server'
import { verifyTokenMatches } from '@/lib/whatsapp/signature'

/** Vercel Cron's `Authorization: Bearer $CRON_SECRET`, fail-closed without the secret. Null when authorised. */
export function cronAuthError(request: Request, name: string): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error(`[${name}] CRON_SECRET is not configured`)
    return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  }
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  return verifyTokenMatches(token, secret) ? null : NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
}
