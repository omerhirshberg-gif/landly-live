import { NextResponse } from 'next/server'
import { verifyTokenMatches } from '@/lib/whatsapp/signature'
import { previousMonthKey, sendMonthlyCostsReport } from '@/lib/usage/monthlyCostsReport.server'
import { isMonthKey } from '@/lib/usage/usageTypes'

// Vercel Cron (vercel.json: 0 5 1 * *, 05:00 UTC on the 1st) emails the
// Usage & Costs summary of the month that just ended (UTC) to
// COSTS_REPORT_EMAIL (default contact@golandly.com), once: a Firestore lock
// absorbs duplicate triggers (lib/usage/monthlyCostsReport.server.ts).
// Authorization: Bearer $CRON_SECRET, fail-closed without it, like
// /api/cron/whatsapp-idle. ?month=YYYY-MM re-runs another month by hand.

export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[monthly-costs] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  }
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  if (!verifyTokenMatches(token, secret)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const requested = new URL(request.url).searchParams.get('month')
  if (requested !== null && !isMonthKey(requested)) return NextResponse.json({ error: 'Invalid month.' }, { status: 400 })
  const month = requested ?? previousMonthKey()

  try {
    const outcome = await sendMonthlyCostsReport({ month, guarded: true })
    return NextResponse.json({ ok: true, ...outcome }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[monthly-costs] send failed', error)
    return NextResponse.json({ error: 'The report could not be sent.' }, { status: 502 })
  }
}
