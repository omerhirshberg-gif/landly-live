import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { buildUsageReport, isUsageView } from '@/lib/usage/usageReport'
import { loadUsageSources } from '@/lib/usage/usageSources'
import { isMonthKey, monthKeyOf } from '@/lib/usage/usageTypes'

// /admin/system/costs: one month's API usage, priced (lib/usage/usageReport.ts),
// for PROD, DEV or both combined. This deployment's own counters come from
// its own project; the other environment's as lib/usage/usageSources.ts
// can reach them, with a status when it can't.
// GET ?month=YYYY-MM (default: the current UTC month) &view=combined|prod|dev (default: combined).

export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const params = new URL(request.url).searchParams
  const requested = params.get('month')
  if (requested !== null && !isMonthKey(requested)) return NextResponse.json({ error: 'Invalid month.' }, { status: 400 })
  const view = params.get('view') ?? 'combined'
  if (!isUsageView(view)) return NextResponse.json({ error: 'Invalid view.' }, { status: 400 })
  const month = requested ?? monthKeyOf(new Date())

  try {
    const { prod, dev } = await loadUsageSources(month)
    return NextResponse.json(buildUsageReport({ month, view, prod, dev }), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Usage report failed', error)
    return NextResponse.json({ error: 'Usage data is unavailable right now.' }, { status: 502 })
  }
}
