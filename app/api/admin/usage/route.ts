import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { getAdminDb, getAdminProjectId } from '@/lib/firebase/admin'
import { buildUsageReport } from '@/lib/usage/usageReport'
import { QUOTA_FIELD, sumLifetime } from '@/lib/usage/quota'
import { countersOf, isMonthKey, monthKeyOf, QUOTA_DOC_ID, USAGE_COLLECTION } from '@/lib/usage/usageTypes'

// /admin/system/costs: one month of this deployment's own API usage counters
// (lib/usage/recordUsage.ts), priced (lib/usage/usageReport.ts), plus the
// months there are counters for, and the 019 package quota against lifetime
// sends (lib/usage/quota.ts). Vercel Production reads the PROD project;
// local and Preview their DEV project. GET ?month=YYYY-MM, default the
// current UTC month. A document that names another project is refused
// rather than shown as this environment's.
const MAX_MONTHS = 24

export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const requested = new URL(request.url).searchParams.get('month')
  if (requested !== null && !isMonthKey(requested)) return NextResponse.json({ error: 'Invalid month.' }, { status: 400 })
  const month = requested ?? monthKeyOf(new Date())

  try {
    const db = getAdminDb()
    const projectId = getAdminProjectId()
    // One list read serves the month picker, the lifetime sums and the quota
    // document (only the fields they need); the month shown is its own read.
    const [snap, list] = await Promise.all([
      db.collection(USAGE_COLLECTION).doc(month).get(),
      db.collection(USAGE_COLLECTION).select('projectId', 'gateway019.smsOtpSent', 'gateway019.whatsappOtpSent', QUOTA_FIELD.sms, QUOTA_FIELD.whatsapp).get(),
    ])
    const data = snap.exists ? snap.data() : undefined
    if (data?.projectId && data.projectId !== projectId) {
      console.error(`[usage] ${USAGE_COLLECTION}/${month} names project ${data.projectId}, not ${projectId}`)
      return NextResponse.json({ error: `These counters belong to ${data.projectId}, not ${projectId}.` }, { status: 409 })
    }
    const docs = list.docs.map((doc) => ({ id: doc.id, data: doc.data?.() }))
    const months = docs.map((doc) => doc.id).filter(isMonthKey).sort().reverse().slice(0, MAX_MONTHS)
    // Documents of another project never count toward this one's totals.
    const own = docs.filter((doc) => {
      const named = (doc.data as { projectId?: unknown } | undefined)?.projectId
      return !named || named === projectId
    })
    const quotaDoc = own.find((doc) => doc.id === QUOTA_DOC_ID)?.data as Record<string, unknown> | undefined
    const report = buildUsageReport({
      month,
      months,
      projectId,
      counters: countersOf(data),
      quota: { sent: sumLifetime(own), quota: { sms: quotaDoc?.[QUOTA_FIELD.sms], whatsapp: quotaDoc?.[QUOTA_FIELD.whatsapp] } },
    })
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Usage report failed', error)
    return NextResponse.json({ error: 'Usage data is unavailable right now.' }, { status: 502 })
  }
}
