import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { ForeignProjectError, loadUsageReport } from '@/lib/usage/loadUsageReport.server'
import { isMonthKey, monthKeyOf } from '@/lib/usage/usageTypes'

// /admin/system/costs: one month of this deployment's own API usage counters
// (lib/usage/recordUsage.ts), priced (lib/usage/usageReport.ts), plus the
// months there are counters for, and the 019 package quota against lifetime
// sends (lib/usage/quota.ts). Vercel Production reads the PROD project;
// local and Preview their DEV project. GET ?month=YYYY-MM, default the
// current UTC month. A document that names another project is refused
// rather than shown as this environment's.
export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const requested = new URL(request.url).searchParams.get('month')
  if (requested !== null && !isMonthKey(requested)) return NextResponse.json({ error: 'Invalid month.' }, { status: 400 })
  const month = requested ?? monthKeyOf(new Date())

  try {
    const report = await loadUsageReport(month)
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof ForeignProjectError) {
      console.error(`[usage] ${error.message}`)
      return NextResponse.json({ error: `These counters belong to ${error.named}, not ${error.projectId}.` }, { status: 409 })
    }
    console.error('Usage report failed', error)
    return NextResponse.json({ error: 'Usage data is unavailable right now.' }, { status: 502 })
  }
}
