import { useMemo, useState } from 'react'
import type { Coordinates } from '@shared/geo'
import { DEFAULT_RADIUS_KM, type LocationFilter, type RadiusKm } from '@shared/perks/locationFilter'

/** The location filter's state: the member's position with a 5 / 15 / 25 km radius, or an area picked by hand. */
export function useLocationFilter() {
  const [coords, setCoords] = useState<Coordinates | null>(null)
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(DEFAULT_RADIUS_KM)
  const [area, setArea] = useState<Extract<LocationFilter, { kind: 'area' }> | null>(null)
  const filter = useMemo<LocationFilter | null>(() => area ?? (coords ? { kind: 'gps', coords, radiusKm } : null), [area, coords, radiusKm])
  return {
    filter,
    setRadiusKm,
    locate: (next: Coordinates) => { setArea(null); setCoords(next) },
    pickArea: (next: Extract<LocationFilter, { kind: 'area' }>) => setArea(next),
    clear: () => { setCoords(null); setArea(null) },
  }
}
