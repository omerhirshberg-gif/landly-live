import 'server-only'
import { getAdminDb, getAdminProjectId } from '@/lib/firebase/admin'
import { currentFirebaseDeployTarget } from '@/lib/firebase/envGuard'
import { peerAccessFor } from './peerGuard'
import { isDevReaderConfigured, listDevUsageMonths, readDevUsageMonth } from './peerUsageDb'
import { fetchProdUsage, PeerExportError } from './peerUsageExport'
import type { SourceData, UsageSource } from './usageReport'
import { countersOf, isMonthKey, USAGE_COLLECTION, USAGE_PROJECTS, usageEnvOf, type UsageEnv } from './usageTypes'

// Both environments' counters for one month, for /api/admin/usage: this
// deployment's own through getAdminDb(), the other's as lib/usage/peerGuard.ts
// allows (PROD reads DEV with the read-only reader; DEV asks PROD's export).
// Loaded side by side; a side that can't be read comes back with its reason
// (status unconfigured / unavailable / mismatch) instead of failing the page.

function failed(source: Omit<UsageSource, 'status' | 'message'>, status: UsageSource['status'], message: string): SourceData {
  return { source: { ...source, status, message }, counters: null, months: [] }
}

async function loadLocal(env: UsageEnv, projectId: string, month: string): Promise<SourceData> {
  const base = { env, projectId, via: 'local' } as const
  try {
    const usage = getAdminDb().collection(USAGE_COLLECTION)
    const [snap, list] = await Promise.all([usage.doc(month).get(), usage.select().get()])
    const data = snap.exists ? snap.data() : undefined
    if (data?.projectId && data.projectId !== projectId) return failed(base, 'mismatch', `These counters name ${data.projectId}, not ${projectId}.`)
    return { source: { ...base, status: 'ok' }, counters: countersOf(data), months: list.docs.map((doc) => doc.id).filter(isMonthKey) }
  } catch (err) {
    console.error('[usage] own counters unreadable', err)
    return failed(base, 'unavailable', 'This environment’s counters could not be read.')
  }
}

async function loadDevWithReader(month: string): Promise<SourceData> {
  const base = { env: 'dev', projectId: USAGE_PROJECTS.dev, via: 'peer-reader' } as const
  if (!isDevReaderConfigured()) return failed(base, 'unconfigured', 'USAGE_DEV_READER_CLIENT_EMAIL / _PRIVATE_KEY are not set in Vercel Production.')
  try {
    const [data, months] = await Promise.all([readDevUsageMonth(month), listDevUsageMonths()])
    if (data?.projectId && data.projectId !== USAGE_PROJECTS.dev) return failed(base, 'mismatch', `These counters name ${String(data.projectId)}, not ${USAGE_PROJECTS.dev}.`)
    return { source: { ...base, status: 'ok' }, counters: countersOf(data), months }
  } catch (err) {
    console.error('[usage] DEV usage reader failed', err instanceof Error ? err.message : err)
    return failed(base, 'unavailable', 'The DEV usage reader could not read the counters (check its key and IAM role).')
  }
}

async function loadProdFromExport(month: string): Promise<SourceData> {
  const base = { env: 'prod', projectId: USAGE_PROJECTS.prod, via: 'peer-export' } as const
  try {
    const exported = await fetchProdUsage(month)
    return { source: { ...base, status: 'ok' }, counters: exported.counters, months: exported.months }
  } catch (err) {
    if (err instanceof PeerExportError) return failed(base, err.status, err.message)
    console.error('[usage] production export failed', err)
    return failed(base, 'unavailable', 'Production’s counters could not be fetched.')
  }
}

export async function loadUsageSources(month: string): Promise<Record<UsageEnv, SourceData>> {
  const projectId = getAdminProjectId()
  const env = usageEnvOf(projectId)
  if (!env) throw new Error(`The usage dashboard reports on ${USAGE_PROJECTS.prod} and ${USAGE_PROJECTS.dev}, not ${projectId}.`)
  const otherEnv: UsageEnv = env === 'prod' ? 'dev' : 'prod'
  const access = peerAccessFor(currentFirebaseDeployTarget())

  let other: Promise<SourceData>
  if (!access) {
    other = Promise.resolve(failed({ env: otherEnv, projectId: USAGE_PROJECTS[otherEnv], via: 'peer-export' }, 'unconfigured', 'This deployment has no route to the other environment.'))
  } else if (access.env !== otherEnv) {
    // envGuard already makes this impossible; never show one project's numbers as the other's.
    other = Promise.resolve(failed({ env: otherEnv, projectId: USAGE_PROJECTS[otherEnv], via: access.via }, 'mismatch', `This deployment runs on ${projectId} but is set up to read ${access.projectId}.`))
  } else {
    other = access.via === 'peer-reader' ? loadDevWithReader(month) : loadProdFromExport(month)
  }

  const [own, peer] = await Promise.all([loadLocal(env, projectId, month), other])
  return env === 'prod' ? { prod: own, dev: peer } : { prod: peer, dev: own }
}
