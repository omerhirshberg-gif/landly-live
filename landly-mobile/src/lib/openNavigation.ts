import { Linking, Platform } from 'react-native'

/**
 * Opens a maps app: on a phone through its own URL scheme, straight into navigation; without the app (the
 * scheme fails to open) the https link, which the store app or the browser picks up. The web build opens the https link.
 */
export async function openNavigation(appUrl: string | null | undefined, webUrl: string) {
  if (Platform.OS === 'web' || !appUrl) return Linking.openURL(webUrl).catch(() => {})
  try {
    await Linking.openURL(appUrl)
  } catch {
    await Linking.openURL(webUrl).catch(() => {})
  }
}
