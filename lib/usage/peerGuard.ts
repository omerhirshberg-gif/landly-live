import type { FirebaseDeployTarget } from '@/lib/firebase/envGuard'
import { countersOf, isMonthKey, USAGE_PROJECTS, type UsageEnv, type UsageExport } from './usageTypes'

// Which other project a deployment may read usage counters from, and how,
// for the Combined view on /admin/system/costs. Each direction keeps PROD's
// service account inside Vercel Production:
//
//  - Vercel Production reads the DEV project's apiUsageStats directly, with a
//    dedicated reader service account whose IAM role can only read
//    (lib/usage/peerUsageDb.ts). Its key is set in Vercel Production only.
//  - local and Vercel Preview fetch PROD's counters from PROD itself
//    (/api/usage/export, bearer USAGE_EXPORT_TOKEN): PROD reads its own
//    Firestore and answers with the counters and nothing else.
//
// Nothing here changes lib/firebase/envGuard.ts or what getAdminDb()
// connects to; these are checks on top. Pure, so it's unit-tested as is.

export type PeerVia = 'peer-reader' | 'peer-export'

export interface PeerAccess {
  env: UsageEnv
  projectId: string
  via: PeerVia
}

/** The other environment for this deploy target, never its own; null where there's none (unit tests, Expo). */
export function peerAccessFor(target: FirebaseDeployTarget): PeerAccess | null {
  if (target === 'production') return { env: 'dev', projectId: USAGE_PROJECTS.dev, via: 'peer-reader' }
  if (target === 'local' || target === 'preview') return { env: 'prod', projectId: USAGE_PROJECTS.prod, via: 'peer-export' }
  return null
}

/** Throws unless `clientEmail` is a service account of the DEV project (the only project read this way). */
export function assertDevReader(clientEmail: string | undefined, privateKey: string | undefined): void {
  if (!clientEmail || !privateKey) throw new Error('USAGE_DEV_READER_CLIENT_EMAIL and USAGE_DEV_READER_PRIVATE_KEY are not both set.')
  if (!clientEmail.toLowerCase().endsWith(`@${USAGE_PROJECTS.dev}.iam.gserviceaccount.com`)) {
    throw new Error(`USAGE_DEV_READER_CLIENT_EMAIL isn't a ${USAGE_PROJECTS.dev} service account.`)
  }
}

/** The export token, when it's long enough to be one; null otherwise (the export stays off, the fetch isn't tried). */
export function usageExportToken(raw = process.env.USAGE_EXPORT_TOKEN): string | null {
  const token = raw?.trim()
  return token && token.length >= 32 ? token : null
}

/**
 * The PROD export's answer as a UsageExport, when it is one and it's for
 * `month` from `projectId`; otherwise why not, for the source's status.
 */
export function parsePeerExport(
  json: unknown,
  expected: { projectId: string; month: string }
): { ok: true; value: UsageExport } | { ok: false; status: 'mismatch' | 'unavailable'; message: string } {
  const body = json as Partial<UsageExport> | null
  if (!body || typeof body !== 'object' || typeof body.projectId !== 'string') {
    return { ok: false, status: 'unavailable', message: 'The export answered with something other than usage counters.' }
  }
  if (body.projectId !== expected.projectId) {
    return { ok: false, status: 'mismatch', message: `The export reported ${body.projectId}, not ${expected.projectId}.` }
  }
  if (body.month !== expected.month) return { ok: false, status: 'unavailable', message: `The export answered for ${String(body.month)}.` }
  const months = Array.isArray(body.months) ? body.months.filter(isMonthKey) : []
  return { ok: true, value: { projectId: body.projectId, month: body.month, months, counters: countersOf(body.counters) } }
}
