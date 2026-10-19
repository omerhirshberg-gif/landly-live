'use client'

import { useState } from 'react'
import { useLang } from '@/lib/i18n/useLang'
import type { Coordinates } from '@/lib/geo'

type GeoState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'

// `action` is the tinted toggle at the end of the /categories search row:
// solid brand while a location is applied, and a second press clears it
// (onClear). Below 640px it's a 44px icon-only square (the label stays for
// screen readers) so the search field keeps the width. Its error floats
// below so the row never shifts.
export default function NearMeButton({
  onLocate,
  onClear,
  variant = 'outline',
}: {
  onLocate: (coords: Coordinates) => void
  onClear?: () => void
  variant?: 'outline' | 'action'
}) {
  const { t } = useLang()
  const [state, setState] = useState<GeoState>('idle')

  const handleClick = () => {
    if (variant === 'action' && state === 'granted') {
      setState('idle')
      onClear?.()
      return
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState('unsupported')
      return
    }
    setState('requesting')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState('granted')
        onLocate({ lat: position.coords.latitude, lng: position.coords.longitude })
      },
      () => setState('denied'),
      { timeout: 10000 }
    )
  }

  const message: Partial<Record<GeoState, string>> = {
    denied: t('geo_denied'),
    unsupported: t('geo_unsupported'),
  }

  return (
    variant === 'action' ? (
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={handleClick}
          disabled={state === 'requesting'}
          aria-pressed={state === 'granted'}
          aria-label={t('geo_near_me_btn')}
          className={`tap-target inline-flex h-11 w-11 flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-0 text-sm font-semibold [-webkit-tap-highlight-color:transparent] transition-colors duration-150 disabled:opacity-60 motion-reduce:transition-none sm:w-auto sm:px-3.5 ${
            state === 'granted'
              ? 'border-brand bg-brand text-white [@media(hover:hover)]:hover:bg-brandDark'
              : 'border-line bg-brandTint text-brand [@media(hover:hover)]:hover:bg-brandLight'
          }`}
        >
          <i aria-hidden="true" className={`fa-solid text-base sm:text-xs ${state === 'requesting' ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'}`}></i>
          {/* Shown from 640px; the button's aria-label names it on phones. Not
              sr-only/sm:not-sr-only: Font Awesome's CDN stylesheet also defines
              .sr-only and loads later, so it beat the not-sr-only reset and kept
              the label hidden at every width. */}
          <span className="hidden sm:inline">{t('geo_near_me_btn')}</span>
        </button>
        {message[state] && (
          <p role="alert" className="absolute end-0 top-full z-10 mt-1.5 w-max max-w-[16rem] text-end text-xs font-semibold text-red-600">
            {message[state]}
          </p>
        )}
      </div>
    ) : (
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={state === 'requesting'}
          className="tap-target inline-flex items-center gap-2 border-2 border-brand text-brand font-bold text-sm px-5 py-2.5 rounded-full hover:bg-brandLight transition disabled:opacity-60"
        >
          <i className="fa-solid fa-location-crosshairs text-xs" aria-hidden="true"></i>
          <span>{t('geo_near_me_btn')}</span>
        </button>
        {message[state] && (
          <p className="text-xs font-semibold text-red-600 text-center max-w-xs">
            {message[state]}
          </p>
        )}
      </div>
    )
  )
}
