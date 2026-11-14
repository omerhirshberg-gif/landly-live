'use client'

import { needsPhoneVerification } from '@/lib/profile/phoneNudge'
import { useLiveUserDocument } from './useLiveUserDocument'

/**
 * Whether the signed-in customer still owes a phone verification (the red "1"
 * on the Profile entry). It reads the live users/{uid} listener rather than
 * the 30-second cached profile, so the badge clears the moment the code is
 * accepted, on every open tab and device.
 */
export function usePhoneVerificationNeeded(uid: string | null): boolean {
  const { profile } = useLiveUserDocument(uid)
  return needsPhoneVerification(profile)
}
