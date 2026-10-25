import 'server-only'
import { SITE_URL } from '@/lib/config'
import { parsePeerExport, usageExportToken } from './peerGuard'
import { USAGE_PROJECTS, type UsageExport } from './usageTypes'

// Local and Vercel Preview's read of PROD's usage counters
// (lib/usage/peerGuard.ts): PROD's own /api/usage/export, with the shared
// USAGE_EXPORT_TOKEN. No PROD credential is needed here, and the answer is
// checked to be PROD's before it's shown. Answers are kept for a minute per
// month, so the dashboard's refresh doesn't call PROD every time.

const TIMEOUT_MS = 5000
const CACHE_MS = 60_000
const cache = new Map<string, { at: number; value: UsageExport }>()

export class PeerExportError extends Error {
  constructor(
    readonly status: 'unconfigured' | 'unavailable' | 'mismatch',
    message: string
  ) {
    super(message)
    this.name = 'PeerExportError'
  }
}

/** PROD's origin: USAGE_PROD_EXPORT_URL (https only), else the site's. */
export function prodExportOrigin(raw = process.env.USAGE_PROD_EXPORT_URL): string {
  const configured = raw?.trim()
  if (!configured) return SITE_URL
  let url: URL
  try {
    url = new URL(configured)
  } catch {
    throw new PeerExportError('unconfigured', 'USAGE_PROD_EXPORT_URL is not a URL.')
  }
  if (url.protocol !== 'https:') throw new PeerExportError('unconfigured', 'USAGE_PROD_EXPORT_URL must be https.')
  return url.origin
}

export function clearPeerExportCache(): void {
  cache.clear()
}

/** PROD's counters for `month`; a PeerExportError says why not. */
export async function fetchProdUsage(month: string, now = Date.now()): Promise<UsageExport> {
  const token = usageExportToken()
  if (!token) throw new PeerExportError('unconfigured', 'USAGE_EXPORT_TOKEN is not set here.')
  const cached = cache.get(month)
  if (cached && now - cached.at < CACHE_MS) return cached.value

  const url = `${prodExportOrigin()}/api/usage/export?month=${encodeURIComponent(month)}`
  let res: Response
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (err) {
    throw new PeerExportError('unavailable', `Production could not be reached (${err instanceof Error ? err.name : 'error'}).`)
  }
  if (res.status === 401) throw new PeerExportError('unconfigured', 'Production refused USAGE_EXPORT_TOKEN: it differs from the one in Vercel Production.')
  if (res.status === 404) throw new PeerExportError('unconfigured', 'The export is switched off in Production (USAGE_EXPORT_TOKEN not set there).')
  if (!res.ok) throw new PeerExportError('unavailable', `Production answered HTTP ${res.status}.`)
  const parsed = parsePeerExport(await res.json().catch(() => null), { projectId: USAGE_PROJECTS.prod, month })
  if (!parsed.ok) throw new PeerExportError(parsed.status, parsed.message)
  cache.set(month, { at: now, value: parsed.value })
  return parsed.value
}
