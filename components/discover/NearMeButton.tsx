'use client'

import { useState } from 'react'
import { useLang } from '@/lib/i18n/useLang'
import type { Coordinates } from '@/lib/geo'

type GeoState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'

export default function NearMeButton({ onLocate }: { onLocate: (coords: Coordinates) => void }) {
  const { t } = useLang()
  const [state, setState] = useState<GeoState>('idle')

  const handleClick = () => {
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
    requesting: t('geo_requesting'),
    denied: t('geo_denied'),
    unsupported: t('geo_unsupported'),
    granted: t('geo_granted'),
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={handleClick}
        disabled={state === 'requesting'}
        className="tap-target inline-flex items-center gap-2 border-2 border-brand text-brand font-bold text-sm px-5 py-2.5 rounded-full hover:bg-brandLight transition disabled:opacity-60"
      >
        <i className="fa-solid fa-location-crosshairs text-xs"></i>
        <span>{t('geo_near_me_btn')}</span>
      </button>
      {message[state] && (
        <p className={`text-xs font-semibold ${state === 'denied' || state === 'unsupported' ? 'text-red-600' : 'text-slate-500'}`}>
          {message[state]}
        </p>
      )}
    </div>
  )
}
