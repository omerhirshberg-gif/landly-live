import 'server-only'
import { getAdminDb, getAdminProjectId } from '@/lib/firebase/admin'
import { getUsdIlsRate } from './exchangeRate.server'
import { loadFixedSubscriptions } from './fixedSubscriptions.server'
import { loadTranzilaUsage } from './tranzilaCost.server'
import { QUOTA_FIELD, sumLifetime } from './quota'
import { buildUsageReport, type UsageReport } from './usageReport'
import { countersOf, isMonthKey, QUOTA_DOC_ID, USAGE_COLLECTION } from './usageTypes'

// One month of this deployment's counters, priced at the live USD/ILS rate:
// shared by /api/admin/usage, the monthly costs cron and the manual send.

const MAX_MONTHS = 24

/** The month's counters belong to another Firebase project than this deployment's. */
export class ForeignProjectError extends Error {
  constructor(public readonly month: string, public readonly named: string, public readonly projectId: string) {
    super(`${USAGE_COLLECTION}/${month} names project ${named}, not ${projectId}`)
  }
}

export async function loadUsageReport(month: string): Promise<UsageReport> {
  const db = getAdminDb()
  const projectId = getAdminProjectId()
  // One list read serves the month picker, the lifetime sums and the quota
  // document (only the fields they need); the month shown is its own read.
  const [snap, list, fx, subscriptions, tranzila] = await Promise.all([
    db.collection(USAGE_COLLECTION).doc(month).get(),
    db.collection(USAGE_COLLECTION).select('projectId', 'gateway019.smsOtpSent', 'gateway019.whatsappOtpSent', QUOTA_FIELD.sms, QUOTA_FIELD.whatsapp).get(),
    getUsdIlsRate(),
    loadFixedSubscriptions(),
    loadTranzilaUsage(db, month),
  ])
  const data = snap.exists ? snap.data() : undefined
  if (data?.projectId && data.projectId !== projectId) throw new ForeignProjectError(month, String(data.projectId), projectId)
  const docs = list.docs.map((doc) => ({ id: doc.id, data: doc.data?.() }))
  const months = docs.map((doc) => doc.id).filter(isMonthKey).sort().reverse().slice(0, MAX_MONTHS)
  // Documents of another project never count toward this one's totals.
  const own = docs.filter((doc) => {
    const named = (doc.data as { projectId?: unknown } | undefined)?.projectId
    return !named || named === projectId
  })
  const quotaDoc = own.find((doc) => doc.id === QUOTA_DOC_ID)?.data as Record<string, unknown> | undefined
  return buildUsageReport({
    month,
    months,
    projectId,
    counters: countersOf(data),
    fx,
    subscriptions,
    tranzila,
    quota: { sent: sumLifetime(own), quota: { sms: quotaDoc?.[QUOTA_FIELD.sms], whatsapp: quotaDoc?.[QUOTA_FIELD.whatsapp] } },
  })
}
