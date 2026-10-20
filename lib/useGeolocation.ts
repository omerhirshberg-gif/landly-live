'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Coordinates } from './geo'

export type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'timeout' | 'unsupported'

// Our own cap on a whole request, prompt included: Firefox's "Not now" (and
// a prompt simply left open) calls neither callback, and the API's own
// `timeout` only starts once permission is given.
const GUARD_MS = 20_000

/**
 * The browser's location for "Near me" (desktop and mobile web). One
 * position per tap, city-level accuracy (fast, light on battery), a fix up to
 * five minutes old accepted. Errors keep their reason: denied (the member or
 * the site setting said no), unavailable (location services off: Chrome
 * Android and iOS Safari report that as POSITION_UNAVAILABLE), timeout, or
 * unsupported (no API, or an insecure page). The Expo app uses expo-location
 * instead (landly-mobile/src/components/NearMeButton.tsx).
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>('idle')
  const request = useRef(0)

  useEffect(() => () => {
    request.current += 1
  }, [])

  const locate = useCallback((): Promise<Coordinates | null> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation || (typeof window !== 'undefined' && !window.isSecureContext)) {
      setStatus('unsupported')
      return Promise.resolve(null)
    }
    const id = ++request.current
    setStatus('requesting')
    return new Promise((resolve) => {
      const settle = (next: GeoStatus, coords: Coordinates | null) => {
        if (id !== request.current) return resolve(null)
        request.current += 1
        clearTimeout(guard)
        setStatus(next)
        resolve(coords)
      }
      const guard = setTimeout(() => settle('timeout', null), GUARD_MS)
      navigator.geolocation.getCurrentPosition(
        (position) => settle('granted', { lat: position.coords.latitude, lng: position.coords.longitude }),
        (error) =>
          settle(error.code === error.PERMISSION_DENIED ? 'denied' : error.code === error.TIMEOUT ? 'timeout' : 'unavailable', null),
        { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 12_000 }
      )
    })
  }, [])

  const reset = useCallback(() => {
    request.current += 1
    setStatus('idle')
  }, [])

  return { status, locate, reset }
}
