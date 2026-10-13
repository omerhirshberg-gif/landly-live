import { Platform, type DimensionValue } from 'react-native'

export const isWeb = Platform.OS === 'web'

// Spread inside StyleSheet.create: the rules apply on web only, and native
// gets an empty object, so iOS/Android touch metrics stay exactly as they are.
export function webOnly<const T extends object>(style: T): T | Record<string, never> {
  return isWeb ? style : {}
}

// react-native-web understands viewport units; RN's DimensionValue type doesn't.
export const VIEWPORT_HEIGHT = '100vh' as unknown as DimensionValue
