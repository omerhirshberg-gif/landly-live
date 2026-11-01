import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { sweepUnsyncedLeads } from '@/lib/marketing/ravMesser.server'
import { verifyTokenMatches } from '@/lib/whatsapp/signature'

// Retries /join leads that haven't reached the Rav Messer list: a sync that
// failed, one that died with its function, and the backfill
// (scripts/backfill-prelaunch-sync.mjs). Vercel Cron calls it every 15 minutes
// on Production (vercel.json) with Authorization: Bearer $CRON_SECRET; anywhere
// else, call it the same way by hand. Fail-closed without CRON_SECRET.

export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[prelaunch-sync] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  }
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  if (!verifyTokenMatches(token, secret)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    return NextResponse.json({ ok: true, ...(await sweepUnsyncedLeads(getAdminDb())) })
  } catch (err) {
    console.error('[prelaunch-sync] sweep failed', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json({ error: 'Sweep failed.' }, { status: 500 })
  }
}
