'use client'

import { useId } from 'react'
import { useLang } from '@/lib/i18n/useLang'
import { localizedName, type Area, type Coordinates } from '@/lib/geo'
import { useGeolocation, type GeoStatus } from '@/lib/useGeolocation'
import type { TranslationKey } from '@/lib/i18n/translations'

const MESSAGES: Partial<Record<GeoStatus, TranslationKey>> = {
  denied: 'geo_denied',
  unavailable: 'geo_off',
  timeout: 'geo_timeout',
  unsupported: 'geo_unsupported',
}

// The tinted toggle at the end of the /categories search row: solid brand
// while a location is applied (the member's own, or an area they picked),
// and a second press clears it. Below 640px it's a 44px icon-only square
// (the label stays for screen readers) so the search field keeps the width.
// When the browser can't give a location (permission denied, location
// services off, timeout, no support), a note floats under the row, so the
// row never shifts, with a "Choose area" list of the cities that have perks:
// a native <select>, which phones show as their own picker (iOS wheel,
// Android sheet). The Expo app's counterpart is
// landly-mobile/src/components/NearMeButton.tsx.
export default function NearMeButton({
  active,
  onLocate,
  onClear,
  areas = [],
  onChooseArea,
}: {
  /** A location is applied (from this button or an area). */
  active: boolean
  onLocate: (coords: Coordinates) => void
  onClear: () => void
  areas?: Area[]
  onChooseArea?: (area: Area) => void
}) {
  const { t, lang } = useLang()
  const { status, locate, reset } = useGeolocation()
  const selectId = useId()

  const handleClick = async () => {
    if (active) {
      reset()
      onClear()
      return
    }
    const coords = await locate()
    if (coords) onLocate(coords)
  }

  const message = !active && MESSAGES[status]
  const requesting = status === 'requesting'

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={handleClick}
        disabled={requesting}
        aria-pressed={active}
        aria-label={t('geo_near_me_btn')}
        className={`tap-target inline-flex h-11 w-11 flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-0 text-sm font-semibold [-webkit-tap-highlight-color:transparent] transition-colors duration-150 disabled:opacity-60 motion-reduce:transition-none sm:w-auto sm:px-3.5 ${
          active
            ? 'border-brand bg-brand text-white [@media(hover:hover)]:hover:bg-brandDark'
            : 'border-line bg-brandTint text-brand [@media(hover:hover)]:hover:bg-brandLight'
        }`}
      >
        <i aria-hidden="true" className={`fa-solid text-base sm:text-xs ${requesting ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'}`}></i>
        {/* Shown from 640px; the button's aria-label names it on phones. Not
            sr-only/sm:not-sr-only: Font Awesome's CDN stylesheet also defines
            .sr-only and loads later, so it beat the not-sr-only reset and kept
            the label hidden at every width. */}
        <span className="hidden sm:inline">{t('geo_near_me_btn')}</span>
      </button>
      {message && (
        <div
          role="alert"
          className="drop-in absolute end-0 top-full z-20 mt-1.5 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-line bg-white p-3 text-start shadow-lg"
        >
          <p className="text-xs font-semibold leading-snug text-red-600">{t(message)}</p>
          {areas.length > 0 && onChooseArea && (
            <>
              <label htmlFor={selectId} className="mt-2.5 block text-xs font-bold text-ink">
                {t('geo_choose_area')}
              </label>
              {/* 16px text so iOS Safari doesn't zoom into it. */}
              <select
                id={selectId}
                defaultValue=""
                onChange={(e) => {
                  const area = areas.find((a) => a.key === e.target.value)
                  if (!area) return
                  reset()
                  onChooseArea(area)
                }}
                className="mt-1 block min-h-11 w-full cursor-pointer rounded-lg border border-line bg-white px-3 text-base text-ink"
              >
                <option value="" disabled>
                  {t('geo_choose_area_title')}
                </option>
                {areas.map((area) => (
                  <option key={area.key} value={area.key}>
                    {localizedName(area.name, lang)}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}
    </div>
  )
}
