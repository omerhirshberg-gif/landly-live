'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { deriveAreas, localizedName, reverseGeocode, type Area, type Coordinates } from '@/lib/geo'
import { getAllOffers, isOfferAvailable } from '@/lib/firebase/offers'
import { useLang } from '@/lib/i18n/useLang'
import { DEFAULT_RADIUS_KM, type LocationFilter, type RadiusKm } from './locationFilter'

/** The location "Near me" applies: the member's own, or an area they picked instead. */
export type PerksOrigin = { coords: Coordinates; area: Area | null }

interface PerksSearchValue {
  origin: PerksOrigin | null
  setOrigin: (origin: PerksOrigin | null) => void
  /** The city name for the applied location (a picked area names itself; the member's own is reverse-geocoded). */
  placeName: string | null
  /** The cities with perks, for the area picker. Empty until `loadAreas` has run. */
  areas: Area[]
  /** Reads the offers once (the shared cached read) and derives the areas; a no-op after the first call. */
  loadAreas: () => void
  /** The Near me radius (5 / 15 / 25 km) and a region or city picked by hand; `filter` is what the lists apply. */
  radiusKm: RadiusKm
  setRadiusKm: (km: RadiusKm) => void
  areaPick: Extract<LocationFilter, { kind: 'area' }> | null
  setAreaPick: (area: Extract<LocationFilter, { kind: 'area' }> | null) => void
  filter: LocationFilter | null
}

const NOOP: PerksSearchValue = { origin: null, setOrigin: () => {}, placeName: null, areas: [], loadAreas: () => {}, radiusKm: DEFAULT_RADIUS_KM, setRadiusKm: () => {}, areaPick: null, setAreaPick: () => {}, filter: null }
const PerksSearchContext = createContext<PerksSearchValue>(NOOP)

// What the persistent search bar shares across pages: the Near Me location.
// It lives in memory (never in the URL: coordinates are personal data), so it
// survives client-side navigation between Home, Perks, an offer, and the rest,
// but not a reload. The area picker's offer list is read lazily, the first
// time Near Me is pressed on a page that hasn't loaded the offers itself.
export function PerksSearchProvider({ children }: { children: ReactNode }) {
  const { lang } = useLang()
  const [origin, setOrigin] = useState<PerksOrigin | null>(null)
  const [geocodedPlace, setGeocodedPlace] = useState<string | null>(null)
  const [areas, setAreas] = useState<Area[]>([])
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(DEFAULT_RADIUS_KM)
  const [areaPick, setAreaPick] = useState<Extract<LocationFilter, { kind: 'area' }> | null>(null)
  const areasRequested = useRef(false)

  const coords = origin?.coords ?? null
  useEffect(() => {
    setGeocodedPlace(null)
    if (!coords || origin?.area) return
    let cancelled = false
    reverseGeocode(coords, lang).then((city) => {
      if (!cancelled) setGeocodedPlace(city)
    })
    return () => { cancelled = true }
  }, [coords, origin?.area, lang])

  const loadAreas = useCallback(() => {
    if (areasRequested.current) return
    areasRequested.current = true
    getAllOffers()
      .then((offers) => setAreas(deriveAreas(offers.filter(isOfferAvailable))))
      .catch(() => { areasRequested.current = false })
  }, [])

  const placeName = origin?.area ? localizedName(origin.area.name, lang) : geocodedPlace
  const filter = useMemo<LocationFilter | null>(() => areaPick ?? (coords ? { kind: 'gps', coords, radiusKm } : null), [areaPick, coords, radiusKm])
  const value = useMemo(() => ({ origin, setOrigin, placeName, areas, loadAreas, radiusKm, setRadiusKm, areaPick, setAreaPick, filter }), [origin, placeName, areas, loadAreas, radiusKm, areaPick, filter])
  return <PerksSearchContext.Provider value={value}>{children}</PerksSearchContext.Provider>
}

export function usePerksSearch(): PerksSearchValue {
  return useContext(PerksSearchContext)
}
