'use client'

import { createContext, ReactNode, useCallback, useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { rememberMemberHint } from '@/lib/auth/memberHint'
import { sessionOnboardingStatus } from '@/lib/auth/onboardingStatus'
import { watchAuthState } from './authReady'
import { auth } from './config'
import { getUserDocument } from './users'

interface AuthContextValue {
  user: User | null
  loading: boolean
  /**
   * Whether the signed-in member has finished onboarding: null while it's
   * being read (or with nobody signed in), then true/false. Read once per
   * sign-in from users/{uid}, so a reload during the wizard is caught before
   * any member page shows (web: useOnboardingGuard; Expo: the root layout).
   */
  onboardingComplete: boolean | null
  /** Records the answer for the signed-in member without another read (sign-in found it, the wizard finished). */
  setOnboardingComplete: (complete: boolean) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  children,
  readyTimeoutMs,
  memberHint = false,
}: {
  children: ReactNode
  /**
   * Stop waiting for Firebase Auth after this long and carry on as a guest; a
   * late answer still signs the member in. Off by default (the app waits as
   * before); the website sets it, because a browser whose storage stalls
   * (WebKit's IndexedDB, say) could otherwise hold every page in its
   * loading state for good.
   */
  readyTimeoutMs?: number
  /** Keep lib/auth/memberHint.ts's flag current (website only). */
  memberHint?: boolean
}) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // Keyed by uid, so an answer read for one account never applies to the next.
  const [status, setStatus] = useState<{ uid: string; complete: boolean } | null>(null)

  useEffect(
    () =>
      watchAuthState<User>(
        (next) => onAuthStateChanged(auth, next),
        {
          onUser: (nextUser) => {
            setUser(nextUser)
            if (memberHint) rememberMemberHint(!!nextUser)
          },
          onReady: () => setLoading(false),
        },
        readyTimeoutMs,
      ),
    [readyTimeoutMs, memberHint]
  )

  const uid = user?.uid ?? null
  const verified = !!user?.emailVerified

  useEffect(() => {
    // A fresh read per session: signing out (or in as someone else) forgets the last answer.
    setStatus(null)
    if (!uid) return
    // Unverified sessions never reach member pages (sign-in signs them back
    // out) and can't read their doc, so there's nothing to gate.
    if (!verified) {
      setStatus({ uid, complete: true })
      return
    }
    let cancelled = false
    const providerIds = auth.currentUser?.providerData.map((p) => p.providerId) ?? []
    getUserDocument(uid)
      // No doc: ungated for a password session (a business account, or a
      // sign-in still creating it, which decides on its own); owed for a
      // Google or Apple one, whose doc the sign-in screen then recreates.
      .then((doc) => sessionOnboardingStatus(doc, providerIds))
      // A failed read doesn't lock a member out of the site; the next sign-in checks again.
      .catch(() => true)
      .then((complete) => {
        // An answer recorded meanwhile (sign-in read the doc after creating it) wins.
        if (!cancelled) setStatus((prev) => (prev?.uid === uid ? prev : { uid, complete }))
      })
    return () => {
      cancelled = true
    }
  }, [uid, verified])

  const setOnboardingComplete = useCallback(
    (complete: boolean) => {
      const current = auth.currentUser?.uid
      if (current) setStatus({ uid: current, complete })
    },
    []
  )

  const onboardingComplete = uid && status?.uid === uid ? status.complete : null

  return (
    <AuthContext.Provider value={{ user, loading, onboardingComplete, setOnboardingComplete }}>{children}</AuthContext.Provider>
  )
}
