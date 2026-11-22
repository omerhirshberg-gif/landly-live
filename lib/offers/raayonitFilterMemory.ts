import type { Coordinates } from '../geo'

/** The hub's filters survive opening a business and coming back (the page remounts): kept for the tab session only, nothing leaves the device. */
const KEY = 'landly_raayonit_filters'
export interface RememberedFilters { category: string; region: string; near: Coordinates | null }

export function readFilters(): RememberedFilters | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Partial<RememberedFilters> | null
    if (!raw || typeof raw.category !== 'string' || typeof raw.region !== 'string') return null
    const n = raw.near
    return { category: raw.category, region: raw.region, near: n && Number.isFinite(n.lat) && Number.isFinite(n.lng) ? { lat: n.lat, lng: n.lng } : null }
  } catch { return null }
}

export function writeFilters(f: RememberedFilters): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(f)) } catch { /* private mode: the filters just reset on return */ }
}
