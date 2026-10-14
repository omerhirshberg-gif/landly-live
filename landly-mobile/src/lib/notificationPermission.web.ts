// Browser build of notificationPermission.ts (expo-notifications has no web
// support): the Web Notification API. Browsers without it (iOS Safari
// outside an installed web app) resolve false, and the sign-up carries on.
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission !== 'default') return Notification.permission === 'granted'
  try {
    return (await Notification.requestPermission()) === 'granted'
  } catch {
    return false
  }
}
