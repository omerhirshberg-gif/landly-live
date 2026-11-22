import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { runInventoryAlerts } from '@/lib/inventory/ledger/alerts'
import { sendInventoryAlertEmail } from '@/lib/inventory/ledger/alertEmail'
import { safeErrorText } from '@/lib/inventory/ledger/codes'
import { cronAuthError } from '@/lib/inventory/ledger/cronAuth'
import { sendExpiryReminders } from '@/lib/inventory/ledger/customerReminders'
import { expireDueVouchers } from '@/lib/inventory/ledger/operations'
import { RECONCILIATION_COLLECTION } from '@/lib/inventory/ledger/types'

// Once a day (vercel.json): expire what is past its date, raise the stock / balance / supplier alerts, remind members 30 and 7
// days before their voucher expires, and record the run in reconciliationRuns/{day}. Every step is idempotent.
export const maxDuration = 300

export async function GET(request: Request) {
  const denied = cronAuthError(request, 'inventory-daily')
  if (denied) return denied
  const db = getAdminDb()
  const now = Timestamp.now()
  const day = new Date(now.toMillis() + 2 * 3600_000).toISOString().slice(0, 10)
  const out: Record<string, unknown> = { day }
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try { out[name] = await fn() } catch (error) { out[name] = { error: safeErrorText(error) }; console.error(`[inventory-daily] ${name} failed`, safeErrorText(error)) }
  }
  await step('expired', () => expireDueVouchers(db, now))
  await step('alerts', async () => {
    const run = await runInventoryAlerts(db, now)
    return { ...run, email: await sendInventoryAlertEmail(run, day) }
  })
  await step('reminders', () => sendExpiryReminders(db, now))
  await db.collection(RECONCILIATION_COLLECTION).doc(day).set({ ...JSON.parse(JSON.stringify(out)), at: now }, { merge: true })
  return NextResponse.json({ ok: true, ...out }, { headers: { 'Cache-Control': 'no-store' } })
}
