import 'server-only'
import { getAdminDb, getAdminProjectId } from '@/lib/firebase/admin'
import { DEFAULT_FX, type FxInfo } from './usageReport'

// The USD/ILS rate that prices Google's dollar bills on /admin/system/costs and
// in the monthly costs email. Order: memory (12 h) -> Firestore
// system_config/usd_ils_rate (12 h) -> Bank of Israel representative rate ->
// Frankfurter (ECB) -> the stored rate however old (stale) -> 3.70 only when
// none was ever stored. Each live source has a 3 s timeout. Never throws.
// Each deployment caches in its own Firebase project (getAdminDb), so DEV and
// PROD behave alike and never share a document.

export const RATE_DOC = 'system_config/usd_ils_rate'
export const RATE_TTL_MS = 12 * 60 * 60 * 1000
const TIMEOUT_MS = 3000
const MIN_RATE = 2
const MAX_RATE = 6

const BOI_URL = 'https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS?lastNObservations=1&format=sdmx-json'
const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=ILS'

type LiveSource = 'boi' | 'frankfurter'

interface Stored {
  rate: number
  fetchedAt: string
  source: LiveSource
}

let memory: (Stored & { at: number }) | null = null

/** Test hook: forgets the in-memory rate. */
export function resetRateCache(): void {
  memory = null
}

const plausible = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= MIN_RATE && value <= MAX_RATE

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' }, cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** The single observation of an SDMX-JSON answer: dataSets[0].series.<key>.observations.<n>[0], a string. */
export function parseBoi(json: unknown): number | null {
  const series = (json as { data?: { dataSets?: { series?: Record<string, { observations?: Record<string, unknown[]> }> }[] } })?.data?.dataSets?.[0]?.series
  const first = series ? Object.values(series)[0]?.observations : undefined
  if (!first) return null
  const keys = Object.keys(first).sort((a, b) => Number(a) - Number(b))
  const value = Number(first[keys.at(-1)!]?.[0])
  return plausible(value) ? value : null
}

export function parseFrankfurter(json: unknown): number | null {
  const value = (json as { rates?: { ILS?: unknown } })?.rates?.ILS
  return plausible(value) ? value : null
}

async function fetchLive(): Promise<{ rate: number; source: LiveSource } | null> {
  const sources: [LiveSource, string, (json: unknown) => number | null][] = [
    ['boi', BOI_URL, parseBoi],
    ['frankfurter', FRANKFURTER_URL, parseFrankfurter],
  ]
  for (const [source, url, parse] of sources) {
    try {
      const rate = parse(await getJson(url))
      if (rate !== null) return { rate, source }
      console.error(`[usd-ils] ${source} answered without a usable rate`)
    } catch (error) {
      console.error(`[usd-ils] ${source} failed`, error)
    }
  }
  return null
}

async function readStored(): Promise<Stored | null> {
  try {
    const snap = await getAdminDb().doc(RATE_DOC).get()
    const data = snap.exists ? snap.data() : undefined
    if (!plausible(data?.rate) || typeof data?.fetchedAt !== 'string' || Number.isNaN(Date.parse(data.fetchedAt))) return null
    const source: LiveSource = data.source === 'frankfurter' ? 'frankfurter' : 'boi'
    return { rate: data.rate, fetchedAt: data.fetchedAt, source }
  } catch (error) {
    console.error('[usd-ils] reading the stored rate failed', error)
    return null
  }
}

const fresh = (fetchedAt: string, now: number) => now - Date.parse(fetchedAt) < RATE_TTL_MS

function info(stored: Stored, stale: boolean): FxInfo {
  return { usdToIls: stored.rate, updatedAt: stored.fetchedAt, source: stored.source, stale, verifiedAt: stored.fetchedAt.slice(0, 7) }
}

export async function getUsdIlsRate(now: Date = new Date()): Promise<FxInfo> {
  const t = now.getTime()
  if (memory && fresh(memory.fetchedAt, t)) return info(memory, false)

  const stored = await readStored()
  if (stored && fresh(stored.fetchedAt, t)) {
    memory = { ...stored, at: t }
    return info(stored, false)
  }

  const live = await fetchLive()
  if (live) {
    const next: Stored = { rate: live.rate, fetchedAt: now.toISOString(), source: live.source }
    memory = { ...next, at: t }
    try {
      await getAdminDb().doc(RATE_DOC).set({ ...next, projectId: getAdminProjectId() })
    } catch (error) {
      console.error('[usd-ils] storing the rate failed', error)
    }
    return info(next, false)
  }

  if (stored) return info(stored, true)
  return DEFAULT_FX
}
