import { isOnboardingComplete } from '@/lib/auth/onboardingStatus'

// The "Verify your phone number" nudge for customer members: a card at the
// top of the Profile screen (web ProfileSection, the app's Profile tab) and a
// red "1" on the Profile entry of the navigation (tab bar, navbar avatar,
// mobile menu), the way Apple's Settings flags an unfinished account.
//
// - Who: a signed-in customer (a users/{uid} document exists: business and
//   staff accounts have none) who finished onboarding and whose phone isn't
//   verified yet (users/{uid}.phoneVerified, set only by
//   /api/account/verify-phone-otp). A member with no phone saved yet counts.
// - The live users/{uid} listener drives both, so verifying on any device
//   removes the card and the badge everywhere at once.
// - Dismissing the card (✕) hides only the card, for 7 days per member on
//   this device (localStorage on the web, AsyncStorage in the app). The badge
//   stays until the phone is verified.

export const PHONE_NUDGE_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

export const phoneNudgeSnoozeKey = (uid: string) => `landly.phoneNudgeSnoozed.${uid}`

/** The profile fields the nudge reads (a UserDocument has them all). */
export interface PhoneNudgeProfile {
  phone: string
  customerType: string
  onboardingCompleted?: boolean
  phoneVerified?: boolean
}

/** Whether this member owes a phone verification: drives the nav badge. */
export function needsPhoneVerification(profile: PhoneNudgeProfile | null): boolean {
  return !!profile && isOnboardingComplete(profile) && profile.phoneVerified !== true
}

/** `snoozedAt` is the stored epoch-milliseconds string: snoozed for 7 days from then. */
export function isPhoneNudgeSnoozed(snoozedAt: string | null, now = Date.now()): boolean {
  const at = Number(snoozedAt)
  return Number.isFinite(at) && at > 0 && now - at < PHONE_NUDGE_SNOOZE_MS
}

/** Whether the Profile card shows: owed, and not snoozed. (The badge ignores the snooze.) */
export function phoneNudgeCardVisible(profile: PhoneNudgeProfile | null, snoozedAt: string | null, now = Date.now()): boolean {
  return needsPhoneVerification(profile) && !isPhoneNudgeSnoozed(snoozedAt, now)
}
