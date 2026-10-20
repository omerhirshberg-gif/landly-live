import type { Lang } from '../i18n/translations'

// Push notifications: the schema only, for the branch that ships them.
// Nothing registers or sends yet; firestore.rules already guards the path.
//
//   users/{uid}/pushTokens/{tokenHash}
//
// Native (iOS/Android): Expo push tokens from expo-notifications
// (getExpoPushTokenAsync; needs a development build with EAS project id and
// APNs/FCM credentials). Expo's push service delivers through APNs and FCM.
// Web: Firebase Cloud Messaging tokens (firebase/messaging + a service
// worker + a VAPID key, NEXT_PUBLIC_FIREBASE_VAPID_KEY). On iOS Safari web
// push only works from a home-screen install (iOS 16.4+), so the web
// settings toggle is shown only where PushManager exists.
//
// Planned senders, all server side (Admin SDK): a new perk in the member's
// home city or a wished-for category, and a voucher about to expire. "Nearby"
// pushes use a home city the member chooses, never background location (the
// app only asks for location while in use; see landly-mobile/app.json).

export type PushPlatform = 'ios' | 'android' | 'web'
export type PushProvider = 'expo' | 'fcm'

export interface PushTokenDocument {
  token: string
  platform: PushPlatform
  provider: PushProvider
  /** The member's language when registered, so a push is written in it. */
  lang: Lang
  createdAt: Date
  updatedAt: Date
}

export type PushTopic = 'new_perk_home_city' | 'new_perk_wishlist_category' | 'voucher_expiring'

export function pushTokenPath(uid: string, tokenHash: string): string {
  return `users/${uid}/pushTokens/${tokenHash}`
}
