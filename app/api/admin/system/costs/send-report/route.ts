import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { sendMonthlyCostsReport } from '@/lib/usage/monthlyCostsReport.server'
import { isMonthKey } from '@/lib/usage/usageTypes'

// POST /api/admin/system/costs/send-report { month: 'YYYY-MM', lang?: 'en' | 'he' }:
// the admin emails the Usage & Costs report of any month on demand, to
// COSTS_REPORT_EMAIL (default contact@golandly.com). Same session and
// same-origin checks as every /api/admin/* route; not subject to the cron's
// once-a-month lock, but throttled to one send per month every 30 seconds.
const COOLDOWN_MS = 30_000
const recent = new Map<string, number>()

export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const body = await request.json().catch(() => null)
  if (!isMonthKey(body?.month)) return NextResponse.json({ error: 'Invalid month.' }, { status: 400 })
  const month: string = body.month
  const lang = body?.lang === 'he' ? 'he' : 'en'

  const now = Date.now()
  if (now - (recent.get(month) ?? 0) < COOLDOWN_MS) return NextResponse.json({ error: 'Just sent. Wait a moment.' }, { status: 429 })
  recent.set(month, now)

  try {
    const outcome = await sendMonthlyCostsReport({ month, lang, guarded: false })
    return NextResponse.json({ ok: true, ...outcome }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    recent.delete(month)
    console.error('[monthly-costs] manual send failed', error)
    return NextResponse.json({ error: 'The report could not be sent.' }, { status: 502 })
  }
}
