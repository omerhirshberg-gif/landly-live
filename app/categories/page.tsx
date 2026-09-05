'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import NearMeButton from '@/components/discover/NearMeButton'
import { useLang } from '@/lib/i18n/useLang'
import { TranslationKey } from '@/lib/i18n/translations'
import { sortByDistance, reverseGeocode, Coordinates } from '@/lib/geo'
import type { Business } from '@/lib/types/business'

// No businesses onboarded yet — populated once real listings exist.
const BUSINESSES: Business[] = []

type Tile = { emoji: string; labelKey: TranslationKey; newDot?: boolean }

function TileCard({ tile, t }: { tile: Tile; t: (key: TranslationKey) => string }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 text-center hover:border-brand hover:shadow-md transition cursor-pointer relative">
      {tile.newDot && <span className="new-badge-dot" style={{ position: 'absolute', top: 14, right: 14 }}></span>}
      <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">{tile.emoji}</div>
      <div className="font-bold text-slate-900 text-sm sm:text-base">{t(tile.labelKey)}</div>
    </div>
  )
}

const TILES: Tile[] = [
  { emoji: '✨', labelKey: 'row_new', newDot: true },
  { emoji: '🔥', labelKey: 'row_bestsellers' },
  { emoji: '🍽️', labelKey: 'row_restaurants' },
  { emoji: '🏖️', labelKey: 'row_beach' },
  { emoji: '🎯', labelKey: 'cats_attractions_tours' },
  { emoji: '👗', labelKey: 'row_fashion' },
  { emoji: '💪', labelKey: 'row_sport' },
  { emoji: '🏨', labelKey: 'row_tourism' },
  { emoji: '🥂', labelKey: 'row_bundles' },
  { emoji: '💅', labelKey: 'row_beauty' },
  { emoji: '🏠', labelKey: 'cats_home' },
  { emoji: '👶', labelKey: 'cats_kids' },
  { emoji: '📊', labelKey: 'cats_insurance' },
  { emoji: '🚗', labelKey: 'cats_cars' },
]

export default function CategoriesPage() {
  const { t, isRtl } = useLang()
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null)
  const [placeName, setPlaceName] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const nearby = userLocation ? sortByDistance(BUSINESSES, userLocation) : null

  useEffect(() => {
    if (!userLocation) {
      setPlaceName(null)
      return
    }
    let cancelled = false
    reverseGeocode(userLocation).then((place) => {
      if (cancelled) return
      setPlaceName(place ? [place.city, place.state].filter(Boolean).join(', ') : null)
    })
    return () => { cancelled = true }
  }, [userLocation])
  const nearbyByCategory = nearby
    ? nearby.reduce<Map<string, Business[]>>((groups, business) => {
        const group = groups.get(business.category) ?? []
        group.push(business)
        groups.set(business.category, group)
        return groups
      }, new Map())
    : null

  const normalizedQuery = query.trim().toLowerCase()
  const filteredTiles = normalizedQuery
    ? TILES.filter((tile) => t(tile.labelKey).toLowerCase().includes(normalizedQuery))
    : TILES
  const noResults = normalizedQuery.length > 0 && filteredTiles.length === 0

  return (
    <>
      <Navbar />
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{t('cats_page_title')}</h1>
            <NearMeButton onLocate={setUserLocation} />
          </div>

          <div className="relative mb-8">
            <i className={`fa-solid fa-magnifying-glass absolute top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none ${isRtl ? 'left-4' : 'right-4'}`}></i>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('cats_search_placeholder')}
              className="inp pl-11 pr-11"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className={`tap-target absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 text-slate-400 hover:text-slate-600 ${isRtl ? 'right-2' : 'left-2'}`}
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            )}
          </div>

          {nearby && (
            <div className="mb-8">
              <h2 className={`text-sm font-bold text-slate-900 ${nearby.length > 0 && placeName ? 'mb-1' : 'mb-3'}`}>{t('discover_nearby_title')}</h2>
              {nearby.length > 0 && placeName && (
                <p className="text-xs text-slate-500 mb-3">{t('discover_nearby_place').replace('{place}', placeName)}</p>
              )}
              {nearby.length === 0 ? (
                <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
                  <i className="fa-solid fa-tags"></i>
                  <div className="font-bold text-slate-700 text-base mb-1">{t('deals_empty_title')}</div>
                  <p className="text-sm text-slate-500 max-w-xs">{t('deals_empty_sub')}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Array.from(nearbyByCategory!.entries()).map(([category, businesses]) => (
                    <div key={category}>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">{category}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                        {businesses.map((business) => (
                          <div key={business.id} className="bg-white border border-slate-100 rounded-2xl p-4">
                            <div className="font-bold text-slate-900 text-sm">{business.name}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {noResults && (
            <>
              <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl mb-8">
                <i className="fa-solid fa-magnifying-glass"></i>
                <div className="font-bold text-slate-700 text-base mb-1">{t('cats_search_no_results_title').replace('{query}', query.trim())}</div>
                <p className="text-sm text-slate-500 max-w-xs">{t('cats_search_no_results_sub')}</p>
              </div>
              <h2 className="text-sm font-bold text-slate-900 mb-3">{t('cats_search_recommended_title')}</h2>
            </>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {(noResults ? TILES : filteredTiles).map((tile, i) => (
              <TileCard key={i} tile={tile} t={t} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
