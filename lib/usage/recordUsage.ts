import 'server-only'
import { after } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb, getAdminProjectId } from '@/lib/firebase/admin'
import { dayKeyOf, monthKeyOf, USAGE_COLLECTION, type UsageMetric } from './usageTypes'

// Adds to this month's API usage counters (lib/usage/usageTypes.ts), called
// right after a metered call succeeds: Cloud Translation, Google Maps, and
// WhatsApp sends. Never in the way of what it measures: it returns nothing
// to await, the write runs in after() once the response is out (or detached
// outside a request, e.g. a unit test), and any failure -- no credentials,
// Firestore down, a slow write -- is one log line and nothing else. One
// merge write per event, no read: FieldValue.increment creates the month
// on its first event.

const WRITE_TIMEOUT_MS = 3000

export type UsageEntries = Partial<Record<UsageMetric, number>>

/** Only positive, finite amounts; null when nothing is left to record. */
function cleanEntries(entries: UsageEntries): UsageEntries | null {
  const clean = Object.fromEntries(Object.entries(entries).filter(([, n]) => typeof n === 'number' && Number.isFinite(n) && n > 0))
  return Object.keys(clean).length ? (clean as UsageEntries) : null
}

function nestIncrements(entries: UsageEntries): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [metric, amount] of Object.entries(entries)) {
    const path = metric.split('.')
    let node = out
    for (const key of path.slice(0, -1)) node = (node[key] ??= {}) as Record<string, unknown>
    node[path.at(-1)!] = FieldValue.increment(amount!)
  }
  return out
}

/**
 * The merge write for `entries` at `now`: nested maps, because set() takes
 * a dotted key as one field name rather than a path.
 */
export function usageWrite(entries: UsageEntries, now: Date, projectId: string): Record<string, unknown> {
  return {
    month: monthKeyOf(now),
    projectId,
    updatedAt: FieldValue.serverTimestamp(),
    ...nestIncrements(entries),
    daily: { [dayKeyOf(now)]: nestIncrements(entries) },
  }
}

async function writeUsage(entries: UsageEntries, now: Date): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const ref = getAdminDb().collection(USAGE_COLLECTION).doc(monthKeyOf(now))
    const write = ref.set(usageWrite(entries, now, getAdminProjectId()), { merge: true })
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${WRITE_TIMEOUT_MS}ms`)), WRITE_TIMEOUT_MS)
    })
    await Promise.race([write, timeout])
  } catch (err) {
    console.warn(`[usage] counters not recorded (${Object.keys(entries).join(', ')}): ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    clearTimeout(timer)
  }
}

/** Adds each amount to its counter for the current UTC month and day. */
export function recordUsageBatch(entries: UsageEntries, now = new Date()): void {
  const clean = cleanEntries(entries)
  if (!clean) return
  const task = () => writeUsage(clean, now)
  try {
    after(task)
  } catch {
    // Outside a request scope after() throws; the write goes on detached.
    void task()
  }
}

export function recordUsage(metric: UsageMetric, amount = 1, now = new Date()): void {
  recordUsageBatch({ [metric]: amount }, now)
}
