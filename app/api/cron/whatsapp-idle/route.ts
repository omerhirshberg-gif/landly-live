import { NextResponse } from 'next/server'
import { verifyTokenMatches } from '@/lib/whatsapp/signature'
import { sweepIdleConversations } from '@/lib/whatsapp/idleSweep'

// The WhatsApp bot's idle check-ins, silent resolves and expired-chat purge
// (lib/whatsapp/idleSweep.ts). Vercel Cron calls it every 5 minutes on
// Production (vercel.json) with Authorization: Bearer $CRON_SECRET;
// scripts/whatsapp-idle-sweep.mjs does the same against a local or Preview
// deployment, which sweeps the dev project. Fail-closed without CRON_SECRET.

export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[whatsapp-idle] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  }
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  if (!verifyTokenMatches(token, secret)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const result = await sweepIdleConversations()
  return NextResponse.json({ ok: true, ...result })
}
