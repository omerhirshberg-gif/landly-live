import { memo, type ComponentType } from 'react'
import { Image as RNImage, Platform, type ImageResizeMode, type ImageSourcePropType, type ImageStyle, type StyleProp } from 'react-native'
import { requireOptionalNativeModule } from 'expo-modules-core'

// The one place `expo-image` is loaded. Its native module (ExpoImage) only exists in a binary built after the
// package was added, and `import 'expo-image'` throws at module evaluation when it's missing ("Cannot find
// native module 'ExpoImage'"), which took the whole bundle down on a dev client built before it. So the package is
// required lazily, behind a probe for the native module, and React Native's own Image stands in when it's absent.
// On web expo-image is plain JS (an <img>), so it is always used there.

export type ImageContentFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'

/** What every caller reads from a load: the bitmap's own size (expo-image's `e.source`). */
export type SafeImageLoadEvent = { source: { width: number; height: number } }

export type SafeImageSource = ImageSourcePropType | string | null | undefined

export type SafeImageProps = {
  source: SafeImageSource
  style?: StyleProp<ImageStyle>
  contentFit?: ImageContentFit
  /** expo-image only: the fallback has the platform's own cache. */
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk'
  /** expo-image only: keeps a recycled list cell from showing the previous picture. */
  recyclingKey?: string | null
  /** Milliseconds of cross-fade (expo-image only). */
  transition?: number
  blurRadius?: number
  onLoad?: (event: SafeImageLoadEvent) => void
  onError?: () => void
  accessibilityLabel?: string
  accessible?: boolean
  accessibilityIgnoresInvertColors?: boolean
}

type ExpoImageComponent = ComponentType<Record<string, unknown>>

/** expo-image's Image when this binary has it, else null. Decided once at load, never throws. */
function loadExpoImage(): ExpoImageComponent | null {
  try {
    if (Platform.OS === 'web' || requireOptionalNativeModule('ExpoImage')) {
      // Metro bundles this either way; only running it needs the native module.
      return (require('expo-image') as { Image: ExpoImageComponent }).Image
    }
  } catch {
    // Fall through to React Native's Image.
  }
  return null
}

const ExpoImage = loadExpoImage()

const RESIZE_MODE: Record<ImageContentFit, ImageResizeMode> = {
  cover: 'cover',
  contain: 'contain',
  fill: 'stretch',
  none: 'center',
  'scale-down': 'contain',
}

function toRnSource(source: SafeImageSource): ImageSourcePropType | undefined {
  if (source == null) return undefined
  return typeof source === 'string' ? { uri: source } : source
}

function SafeImage({ source, style, contentFit = 'cover', cachePolicy, recyclingKey, transition, blurRadius, onLoad, onError, ...a11y }: SafeImageProps) {
  if (ExpoImage) {
    return (
      <ExpoImage
        source={source}
        style={style}
        contentFit={contentFit}
        cachePolicy={cachePolicy}
        recyclingKey={recyclingKey}
        transition={transition}
        blurRadius={blurRadius}
        onLoad={onLoad}
        onError={onError}
        {...a11y}
      />
    )
  }
  return (
    <RNImage
      source={toRnSource(source) as ImageSourcePropType}
      style={style}
      resizeMode={RESIZE_MODE[contentFit]}
      blurRadius={blurRadius}
      // React Native reports the size under nativeEvent.source; callers see expo-image's shape.
      onLoad={onLoad ? (e) => onLoad({ source: { width: e.nativeEvent.source.width, height: e.nativeEvent.source.height } }) : undefined}
      onError={onError ? () => onError() : undefined}
      {...a11y}
    />
  )
}

export default memo(SafeImage)
export { SafeImage as Image }
