import { useMemo, useSyncExternalStore } from 'react'
import type { Coordinates } from '@shared/geo'
import { DEFAULT_RADIUS_KM, type LocationFilter, type RadiusKm } from '@shared/perks/locationFilter'

type AreaFilter = Extract<LocationFilter, { kind: 'area' }>
interface State { coords: Coordinates | null; radiusKm: RadiusKm; area: AreaFilter | null }

// One location filter for the whole app session: Home, the Perks tab and every category screen read and write the same
// state, so a radius or area set on one carries over when "See all (N)" opens a category or the tab changes. It lives in
// memory only (a restart resets it), and the member's coordinates are never written to disk or put in a route.
let state: State = { coords: null, radiusKm: DEFAULT_RADIUS_KM, area: null }
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const getState = () => state
const update = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()) }

const toFilter = (s: State): LocationFilter | null => s.area ?? (s.coords ? { kind: 'gps', coords: s.coords, radiusKm: s.radiusKm } : null)

/** The location filter's state: the member's position with a 5 / 15 / 25 km radius, or an area picked by hand. */
export function useLocationFilter() {
  const snap = useSyncExternalStore(subscribe, getState, getState)
  const filter = useMemo(() => toFilter(snap), [snap])
  return {
    filter,
    setRadiusKm: (radiusKm: RadiusKm) => update({ radiusKm }),
    locate: (coords: Coordinates) => update({ area: null, coords }),
    pickArea: (area: AreaFilter) => update({ area }),
    clear: () => update({ coords: null, area: null }),
    /** Commits a whole filter at once (the location sheet's Apply); null clears it. */
    apply: (next: LocationFilter | null) =>
      update(next === null ? { coords: null, area: null } : next.kind === 'gps' ? { coords: next.coords, radiusKm: next.radiusKm, area: null } : { coords: null, area: next }),
  }
}

/** Test hook: back to no location. */
export const resetLocationFilter = () => update({ coords: null, radiusKm: DEFAULT_RADIUS_KM, area: null })
