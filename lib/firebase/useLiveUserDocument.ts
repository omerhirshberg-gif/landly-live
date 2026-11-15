'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { auth } from './config'
import { clearOverlay, getOverlayVersion, markPhoneVerified, overlayFor, overlaySettled, subscribeOverlays, withVerifiedPhone } from './liveUserOverlay'
import { invalidateMemberProfile } from './useMemberProfile'
import { subscribeUserDocument, type UserDocument } from './users'

// The profile screens' live copy of users/{uid} (web ProfileSection, the
// app's Profile tab). Firestore keeps the listener connected (and reconnects
// after the app returns from the background), so an email or phone change
// verified anywhere clears its pending notice here. When the confirmed email
// or phone moves, the cached readers (navbar, home greeting) read again, and
// a stale Auth record is reloaded so its email matches.
//
// confirmPhoneVerified() is called the moment a phone code is accepted: it
// lays the verified number over the last snapshot (liveUserOverlay.ts) and
// opens the listener afresh, so the notice, the nudge card and the badge
// clear without waiting for, or depending on, the old listener.
const resubscribers = new Set<() => void>()

export function confirmPhoneVerified(uid: string, phone: string) {
  markPhoneVerified(uid, phone)
  invalidateMemberProfile(uid)
  resubscribers.forEach((resubscribe) => resubscribe())
}

export function useLiveUserDocument(uid: string | null): { profile: UserDocument | null; loaded: boolean } {
  const [state, setState] = useState<{ uid: string; profile: UserDocument | null } | null>(null)
  const previous = useRef<{ email: string; phone: string; phoneVerified: boolean } | null>(null)
  const [generation, setGeneration] = useState(0)
  useSyncExternalStore(subscribeOverlays, getOverlayVersion, getOverlayVersion)

  useEffect(() => {
    const resubscribe = () => setGeneration((n) => n + 1)
    resubscribers.add(resubscribe)
    return () => {
      resubscribers.delete(resubscribe)
    }
  }, [])

  useEffect(() => {
    if (!uid) return
    previous.current = null
    const unsubscribe = subscribeUserDocument(
      uid,
      (profile) => {
        const before = previous.current
        if (profile && before && (before.email !== profile.email || before.phone !== profile.phone || before.phoneVerified !== profile.phoneVerified)) {
          invalidateMemberProfile(uid)
        }
        previous.current = profile ? { email: profile.email, phone: profile.phone, phoneVerified: profile.phoneVerified } : null
        const overlay = overlayFor(uid)
        if (overlay && overlaySettled(profile, overlay)) clearOverlay(uid)
        const current = auth.currentUser
        if (profile?.email && current?.uid === uid && current.email !== profile.email) {
          current.reload().then(() => current.getIdToken(true)).catch(() => {})
        }
        setState({ uid, profile })
      },
      // A failed listener leaves the last known values; the page still renders.
      () => setState((s) => s ?? { uid, profile: null })
    )
    return unsubscribe
  }, [uid, generation])

  const current = state && state.uid === uid ? state : null
  const overlay = overlayFor(uid)
  const profile = useMemo(() => withVerifiedPhone(current?.profile ?? null, overlay), [current, overlay])
  return { profile, loaded: current !== null }
}
