import { useState } from 'react'
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, useWindowDimensions } from 'react-native'
import * as Location from 'expo-location'
import type { Coordinates } from '@shared/geo'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { actionTint, colors, radius } from '../theme'

type GeoState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'

const tint = actionTint

// From this window width the label fits beside the search field (web: the
// `sm` breakpoint on components/discover/NearMeButton.tsx).
const LABEL_MIN_WIDTH = 640

// "Near Me" at the end of the Perks search row. On phones it's an icon-only
// 44pt square (the label is its accessibilityLabel) so the search field keeps
// the width; on wide native windows (tablets, landscape) it shows the label
// too. Not on the Expo web build: there every screen sits in a 480px phone
// column ((tabs)/_layout.web.tsx) however wide the browser is. It asks for
// the location while
// the app is in use (never in the background), turns solid brand blue once it
// has one, and a second tap clears it. Problems go to `onError` so the screen
// can show them under the row. Once the system won't ask again, a tap opens
// the app's Settings instead.
export default function NearMeButton({
  onLocate,
  onClear,
  onError,
}: {
  onLocate: (coords: Coordinates) => void
  onClear: () => void
  onError: (message: string | null) => void
}) {
  const { t } = useLang()
  const [state, setState] = useState<GeoState>('idle')
  const [canAskAgain, setCanAskAgain] = useState(true)

  const locate = async () => {
    if (state === 'granted') {
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
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!permission.granted) {
        setCanAskAgain(permission.canAskAgain)
        setState('denied')
        onError(t('mobile_geo_denied'))
        return
      }
      // A recent fix answers instantly; otherwise wait for a fresh one.
      const position =
        (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))
      setState('granted')
      onLocate({ lat: position.coords.latitude, lng: position.coords.longitude })
    } catch {
      setState('unavailable')
      onError(t('mobile_geo_unavailable'))
    }
  }

  const { width } = useWindowDimensions()
  const showLabel = Platform.OS !== 'web' && width >= LABEL_MIN_WIDTH
  const active = state === 'granted'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('geo_near_me_btn')}
      accessibilityState={{ selected: active, busy: state === 'requesting' }}
      disabled={state === 'requesting'}
      hitSlop={4}
      onPress={locate}
      style={({ pressed }) => [styles.button, showLabel && styles.buttonLabeled, active ? styles.active : pressed && styles.pressed]}
    >
      {state === 'requesting' ? (
        <ActivityIndicator size="small" color={active ? colors.white : tint.text} style={showLabel ? styles.iconSmall : styles.icon} />
      ) : (
        <LineIcon name="locate" size={showLabel ? 16 : 20} color={active ? colors.white : tint.text} strokeWidth={2.2} style={showLabel ? styles.iconSmall : styles.icon} />
      )}
      {showLabel && (
        <AppText style={[styles.label, active && styles.labelActive]} importantForAccessibility="no" accessibilityElementsHidden>
          {t('geo_near_me_btn')}
        </AppText>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // The same 44pt tinted square as WishlistButton beside it.
  button: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: tint.border,
    backgroundColor: tint.bg,
    ...webOnly({ cursor: 'pointer', userSelect: 'none' }),
  },
  // Wide windows: icon + label, sized to the text (web: px-3.5).
  buttonLabeled: { width: 'auto', flexDirection: 'row', gap: 6, paddingHorizontal: 14 },
  pressed: { backgroundColor: tint.bgPressed },
  active: { backgroundColor: colors.brand, borderColor: colors.brand },
  icon: { width: 20, height: 20 },
  iconSmall: { width: 16, height: 16 },
  label: { flexShrink: 0, fontSize: 14, lineHeight: 20, fontWeight: '600', color: tint.text },
  labelActive: { color: colors.white },
})
