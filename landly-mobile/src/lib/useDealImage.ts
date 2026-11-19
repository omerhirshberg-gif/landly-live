import { useEffect, useState } from 'react'
import { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import type { ImageSourcePropType } from 'react-native'
import { brandImageFile, dealImageRole, secureImageUrl, siteImageFile } from './imageSource'
import { bundledBrandImage } from './raayonitBrandImages'

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
/** The fade from the category panel to the arrangement the loaded image calls for. */
export const DEAL_FADE_MS = 180

// Each picture's measured size, kept for the session: a card that scrolls back
// into a recycled list cell, or a screen opened again, knows at once whether
// its picture is a photo or a logo, so it draws it on the first frame instead
// of the category panel and a second fade.
const measuredSizes = new Map<string, { width: number; height: number }>()
const MEASURED_MAX = 600

/** expo-image's load event: the bitmap's own size. */
export type DealImageLoadEvent = { source: { width: number; height: number } }

// The offer's image as a perk card (DealMedia.tsx) and the perk's own page
// (app/offer/[offerId].tsx) both draw it: its link as the device loads it,
// what it is (src/lib/imageSource.ts: a photo, a logo, still unknown or
// none) and the photo's fade in over the category panel. Keyed on the URL,
// so a changed image is measured and tried afresh. The image the caller
// draws (while `role` is 'pending' or 'photo') reports back through
// `onLoad` / `onError`.
export function useDealImage(rawUri: string, opts?: { raayonit?: boolean; graphic?: boolean }) {
  // One of our own brand images is bundled with the app and loaded from there: its stored link (a relative path, or the dev site's
  // http://localhost origin) is not something a device can fetch. Anything else is a web link, https and percent-encoded.
  const bundled = bundledBrandImage(rawUri)
  const siteFile = bundled ? siteImageFile(rawUri) : null
  const uri = bundled ? (siteFile ? `/images/raayonit/${siteFile}` : `/images/raayonit-brands/${brandImageFile(rawUri)}`) : secureImageUrl(rawUri)
  const source: ImageSourcePropType | null = bundled ?? (uri ? { uri } : null)
  const [loadedState, setLoaded] = useState<{ uri: string; width: number; height: number } | null>(null)
  const known = uri ? measuredSizes.get(uri) : undefined
  const loaded = loadedState?.uri === uri ? loadedState : known && uri ? { uri, ...known } : null
  const [failedUri, setFailedUri] = useState<string | null>(null)
  const role = dealImageRole(uri, loaded, failedUri === uri, opts)

  const reduced = useReducedMotion()
  // Already measured: shown from the first frame, no fade.
  const photo = useSharedValue(role === 'photo' ? 1 : 0)
  useEffect(() => {
    const to = role === 'photo' ? 1 : 0
    photo.set(reduced ? to : withTiming(to, { duration: DEAL_FADE_MS, easing: EASE_OUT }))
  }, [role, reduced, photo])
  const photoStyle = useAnimatedStyle(() => ({ opacity: photo.get() }))

  return {
    uri,
    /** What the <Image> loads: the bundled asset, or the web link (null when there is none). */
    source,
    role,
    /** A Raayonit card: DealMedia widens the ambient-backdrop rule (lib/offers/imageFit.ts). */
    ambient: opts?.raayonit === true,
    /** A trimmed brand logo or banner: always shown whole over the backdrop. */
    graphic: opts?.graphic === true,
    /** The loaded bitmap's size, or null until it has loaded (DealMedia reads its shape from it). */
    size: loaded ? { width: loaded.width, height: loaded.height } : null,
    photoStyle,
    onError: () => setFailedUri(uri),
    onLoad: (e: DealImageLoadEvent) => {
      const { width, height } = e.source
      if (uri && width && height) {
        if (measuredSizes.size >= MEASURED_MAX) measuredSizes.clear()
        measuredSizes.set(uri, { width, height })
      }
      if (loaded?.width !== width || loaded?.height !== height) setLoaded({ uri, width, height })
    },
  }
}

export type DealImage = ReturnType<typeof useDealImage>
