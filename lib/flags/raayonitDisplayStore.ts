import { useEffect, useSyncExternalStore } from 'react'
import { getOffersApiBase } from '../offers/offersApi'

// The client side of the Raayonit display gate (the website and the Expo app share this file). The server decides
// (lib/flags/featureFlags.server.ts) and answers GET /api/public/flags; here it is held in one tiny store so the language
// provider and any component can read it. The default is ON (the same on every project), so nothing flashes while the
// answer loads; the server's answer is the kill switch (RAAYONIT_DISPLAY_ENABLED=0 or the admin switch turns it off for everyone).
let current = true
let loadedAt = 0
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()
const REFRESH_MS = 5 * 60 * 1000

export const getRaayonitDisplay = () => current
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }

export function setRaayonitDisplay(next: boolean) {
  loadedAt = Date.now()
  if (next === current) return
  current = next
  for (const fn of listeners) fn()
}

/** Asks the server once per few minutes; never throws, and a failed read leaves the last known value (OFF at start). */
export function loadRaayonitDisplay(fetchImpl: typeof fetch = fetch): Promise<void> {
  if (inflight) return inflight
  if (loadedAt && Date.now() - loadedAt < REFRESH_MS) return Promise.resolve()
  inflight = (async () => {
    try {
      const res = await fetchImpl(`${getOffersApiBase()}/api/public/flags`, { headers: { Accept: 'application/json' } })
      if (res.ok) setRaayonitDisplay(((await res.json()) as { raayonitDisplay?: unknown }).raayonitDisplay === true)
    } catch {
      // keep the last known value
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** Whether Raayonit's name, logo and business list are shown. true unless the server's kill switch says otherwise. */
export function useRaayonitDisplay(): boolean {
  const value = useSyncExternalStore(subscribe, getRaayonitDisplay, () => true)
  useEffect(() => { void loadRaayonitDisplay() }, [])
  return value
}
