import { useState } from 'react'
import { Linking, Platform } from 'react-native'
import * as Location from 'expo-location'
import type { Coordinates } from '@shared/geo'
import { useLang } from '../i18n/LangProvider'
import { impact } from '../lib/haptics'

export type GeoState = 'idle' | 'requesting' | 'denied' | 'unavailable'

// The whole request, permission prompt included, gives up after this.
const GUARD_MS = 20_000

const withTimeout = <T,>(promise: Promise<T>): Promise<T> =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), GUARD_MS))])

/** The locate request behind Near Me (permission, services check, timeout), shared by the button and the Filter sheet's "Near me" row. */
export function useNearMe({ active, onLocate, onClear, onError }: {
  active: boolean
  onLocate: (coords: Coordinates) => void
  onClear: () => void
  onError: (message: string | null) => void
}) {
  const { t } = useLang()
  const [state, setState] = useState<GeoState>('idle')
  const [canAskAgain, setCanAskAgain] = useState(true)
  const fail = (next: GeoState, message: string) => {
    setState(next)
    onError(message)
  }

  const locate = async () => {
    impact()
    if (active) {
      setState('idle')
      onError(null)
      onClear()
      return
    }
    if (!canAskAgain && Platform.OS !== 'web') {
      Linking.openSettings().catch(() => {})
      return
    }
    setState('requesting')
    onError(null)
    try {
      if (Platform.OS !== 'web' && !(await Location.hasServicesEnabledAsync())) {
        // Android can switch location on from a system dialog; iOS only from Settings.
        const enabled = Platform.OS === 'android' && (await Location.enableNetworkProviderAsync().then(() => true, () => false))
        if (!enabled) return fail('unavailable', t('geo_off'))
      }
      const permission = await withTimeout(Location.requestForegroundPermissionsAsync())
      if (!permission.granted) {
        setCanAskAgain(permission.canAskAgain)
        return fail('denied', t('mobile_geo_denied'))
      }
      // A recent fix answers instantly; otherwise wait for a fresh one.
      const position =
        (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 })) ??
        (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })))
      setState('idle')
      onLocate({ lat: position.coords.latitude, lng: position.coords.longitude })
    } catch (error) {
      fail('unavailable', t(error instanceof Error && error.message === 'timeout' ? 'geo_timeout' : 'mobile_geo_unavailable'))
    }
  }

  return { locate, state }
}

