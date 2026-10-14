import { Platform } from 'react-native'

// Asks the OS for notification permission (the sign-up's "Enable
// Notifications" button). Resolves to whether notifications are allowed;
// never throws. The module is loaded on first use, not at startup: in Expo
// Go on Android it warns that remote push is unavailable there, which only
// matters if the user actually asks. (Browser build: notificationPermission.web.ts.)
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const Notifications = await import('expo-notifications')
    const current = await Notifications.getPermissionsAsync()
    if (current.granted) return true
    if (!current.canAskAgain) return false
    // Android 13+ shows the permission prompt only once a channel exists.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Landly',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }
    return (await Notifications.requestPermissionsAsync()).granted
  } catch {
    return false
  }
}
