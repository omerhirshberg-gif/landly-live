import 'server-only'
import { parseLiveDirectory } from '../raayonitLiveDiff'
import { indexUrl } from '../raayonitCatalog'
import type { SupplierBusiness } from './SupplierAdapter'

/** The live "תו על" directory as a flat business list (name + method), read-only. */
export async function fetchRaayonitDirectory(fetcher: typeof fetch = fetch): Promise<SupplierBusiness[]> {
  const res = await fetcher(indexUrl(), { headers: { 'user-agent': 'Mozilla/5.0 (compatible; GoLandlyCatalogSync)' }, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const live = parseLiveDirectory(await res.text())
  return live.entries.map((e) => ({ externalId: e.key, name: e.nameHe ?? e.key, redemptionMethod: e.source, active: true }))
}
