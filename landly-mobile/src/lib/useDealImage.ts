import { useEffect, useState } from 'react'
import type { ImageLoadEventData, NativeSyntheticEvent } from 'react-native'
import { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import { dealImageRole, secureImageUrl } from './imageSource'

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
/** The fade from the category panel to the arrangement the loaded image calls for. */
export const DEAL_FADE_MS = 180

// The offer's image as a perk card (DealMedia.tsx) and the perk's own page
// (app/offer/[offerId].tsx) both draw it: its link as the device loads it,
// what it is (src/lib/imageSource.ts: a photo, a logo, still unknown or
// none) and the photo's fade in over the category panel. Keyed on the URL,
// so a changed image is measured and tried afresh. The image the caller
// draws (while `role` is 'pending' or 'photo') reports back through
// `onLoad` / `onError`.
export function useDealImage(rawUri: string) {
  const uri = secureImageUrl(rawUri)
  const [loaded, setLoaded] = useState<{ uri: string; width: number; height: number } | null>(null)
  const [failedUri, setFailedUri] = useState<string | null>(null)
  const role = dealImageRole(uri, loaded?.uri === uri ? loaded : null, failedUri === uri)

  const reduced = useReducedMotion()
  const photo = useSharedValue(0)
  useEffect(() => {
    const to = role === 'photo' ? 1 : 0
    photo.set(reduced ? to : withTiming(to, { duration: DEAL_FADE_MS, easing: EASE_OUT }))
  }, [role, reduced, photo])
  const photoStyle = useAnimatedStyle(() => ({ opacity: photo.get() }))

  return {
    uri,
    role,
    photoStyle,
    onError: () => setFailedUri(uri),
    onLoad: (e: NativeSyntheticEvent<ImageLoadEventData>) => {
      const { width, height } = e.nativeEvent.source
      setLoaded({ uri, width, height })
    },
  }
}
