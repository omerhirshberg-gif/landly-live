// Asks the browser for notification permission (the onboarding's "Enable
// Notifications" button). Resolves to whether notifications are allowed;
// never throws. Browsers without the API (iOS Safari outside an installed
// web app) resolve false, and the sign-up just carries on.
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission !== 'default') return Notification.permission === 'granted'
  try {
    return (await Notification.requestPermission()) === 'granted'
  } catch {
    return false
  }
}
