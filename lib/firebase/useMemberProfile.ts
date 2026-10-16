'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { User } from 'firebase/auth'
import { avatarInitials, resolveAvatarUrl } from '@/lib/avatar/avatar'
import { greetingName } from '@/lib/auth/names'
import { getUserDocument, type UserDocument } from './users'

// The signed-in member's name and avatar for the post-login surfaces (web
// navbar pill, home greeting, account page; Expo home and profile tabs).
// Components mounting together share one read of users/{uid}; a read is
// reused for a short while, so a later sign-in or a profile edit on another
// device is picked up. An upload (lib/firebase/avatar.ts) publishes its URL
// here, so every mounted avatar swaps at once without another read.
const REUSE_MS = 30_000
const reads = new Map<string, { at: number; read: Promise<UserDocument | null> }>()
const uploaded = new Map<string, string>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version += 1
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getVersion = () => version

function readProfile(uid: string): Promise<UserDocument | null> {
  const cached = reads.get(uid)
  if (cached && Date.now() - cached.at < REUSE_MS) return cached.read
  // A failed read isn't kept: the next mount tries again.
  const read = getUserDocument(uid).catch(() => {
    reads.delete(uid)
    return null
  })
  reads.set(uid, { at: Date.now(), read })
  return read
}

/** Called by the avatar upload: every mounted avatar of this member shows `url`. */
export function publishAvatar(uid: string, url: string) {
  uploaded.set(uid, url)
  emit()
}

/** Called after a profile edit: mounted readers fetch users/{uid} again. */
export function invalidateMemberProfile(uid: string) {
  reads.delete(uid)
  emit()
}

export interface MemberProfile {
  /** users/{uid} has been read (or the read failed) for the current member. */
  loaded: boolean
  profile: UserDocument | null
  /** Greeting name — never derived from the email; null greets without one. */
  firstName: string | null
  /** Monogram letters; '' shows the person glyph. */
  initials: string
  photoURL: string | null
}

export function useMemberProfile(user: User | null): MemberProfile {
  const storeVersion = useSyncExternalStore(subscribe, getVersion, getVersion)
  const uid = user?.uid ?? null
  const [state, setState] = useState<{ uid: string; profile: UserDocument | null } | null>(null)

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    readProfile(uid).then((profile) => {
      if (!cancelled) setState({ uid, profile })
    })
    return () => {
      cancelled = true
    }
  }, [uid, storeVersion])

  const current = uid && state?.uid === uid ? state : null
  const loaded = !!current
  const profile = current?.profile ?? null
  return {
    loaded,
    profile,
    firstName: greetingName(profile, user?.displayName),
    initials: avatarInitials(profile, user?.displayName),
    photoURL: (uid && uploaded.get(uid)) || resolveAvatarUrl(profile, user?.photoURL),
  }
}
