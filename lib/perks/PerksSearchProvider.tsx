'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { deriveAreas, localizedName, reverseGeocode, type Area, type Coordinates } from '@/lib/geo'
import { getAllOffers, isOfferAvailable } from '@/lib/firebase/offers'
import { useLang } from '@/lib/i18n/useLang'

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
}

const NOOP: PerksSearchValue = { origin: null, setOrigin: () => {}, placeName: null, areas: [], loadAreas: () => {} }
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
  const value = useMemo(() => ({ origin, setOrigin, placeName, areas, loadAreas }), [origin, placeName, areas, loadAreas])
  return <PerksSearchContext.Provider value={value}>{children}</PerksSearchContext.Provider>
}

export function usePerksSearch(): PerksSearchValue {
  return useContext(PerksSearchContext)
}
