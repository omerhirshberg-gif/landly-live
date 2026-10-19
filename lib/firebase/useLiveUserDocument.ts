'use client'

import { useEffect, useRef, useState } from 'react'
import { auth } from './config'
import { invalidateMemberProfile } from './useMemberProfile'
import { subscribeUserDocument, type UserDocument } from './users'

// The profile screens' live copy of users/{uid} (web ProfileSection, the
// app's Profile tab). Firestore keeps the listener connected (and reconnects
// after the app returns from the background), so an email or phone change
// verified anywhere clears its pending notice here. When the confirmed email
// or phone moves, the cached readers (navbar, home greeting) read again, and
// a stale Auth record is reloaded so its email matches.
export function useLiveUserDocument(uid: string | null): { profile: UserDocument | null; loaded: boolean } {
  const [state, setState] = useState<{ uid: string; profile: UserDocument | null } | null>(null)
  const previous = useRef<{ email: string; phone: string } | null>(null)

  useEffect(() => {
    if (!uid) return
    previous.current = null
    const unsubscribe = subscribeUserDocument(
      uid,
      (profile) => {
        const before = previous.current
        if (profile && before && (before.email !== profile.email || before.phone !== profile.phone)) {
          invalidateMemberProfile(uid)
        }
        previous.current = profile ? { email: profile.email, phone: profile.phone } : null
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
  }, [uid])

  const current = state && state.uid === uid ? state : null
  return { profile: current?.profile ?? null, loaded: current !== null }
}
