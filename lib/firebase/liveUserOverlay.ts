import type { UserDocument } from './users'

// What the profile screens show the instant a phone code is accepted, before
// (or without) the Firestore listener delivering the verified users/{uid}:
// the new number confirmed and nothing pending. useLiveUserDocument merges it
// over the last snapshot, so the amber notice, the "Complete your profile"
// card and the red "1" clear at once on web and in the app. It drops itself
// as soon as a snapshot agrees (or shows a newer pending change), so it never
// outlives the truth.

export interface VerifiedPhoneOverlay {
  /** The number just verified: it becomes `phone`. */
  phone: string
  /** The pendingPhone the code was for: a snapshot still carrying it is the stale one. */
  clearedPending: string
}

const overlays = new Map<string, VerifiedPhoneOverlay>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version += 1
  listeners.forEach((listener) => listener())
}

export function subscribeOverlays(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const getOverlayVersion = () => version

export const overlayFor = (uid: string | null) => (uid ? overlays.get(uid) : undefined)

export function markPhoneVerified(uid: string, phone: string, clearedPending: string = phone) {
  overlays.set(uid, { phone, clearedPending })
  emit()
}

export function clearOverlay(uid: string) {
  if (overlays.delete(uid)) emit()
}

/** A snapshot that already shows the verified number, or a different pending change, makes the overlay unnecessary. */
export function overlaySettled(profile: UserDocument | null, overlay: VerifiedPhoneOverlay): boolean {
  if (!profile) return false
  if (profile.phoneVerified && !profile.pendingPhone) return true
  return !!profile.pendingPhone && profile.pendingPhone !== overlay.clearedPending
}

/** The snapshot with the verified phone laid over it; the snapshot itself when it needs nothing. */
export function withVerifiedPhone(profile: UserDocument | null, overlay: VerifiedPhoneOverlay | undefined): UserDocument | null {
  if (!profile || !overlay || overlaySettled(profile, overlay)) return profile
  return { ...profile, phone: overlay.phone, phoneVerified: true, pendingPhone: '' }
}
