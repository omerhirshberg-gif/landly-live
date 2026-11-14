'use client'

import { useCallback, useEffect, useState } from 'react'
import { isPhoneNudgeSnoozed, phoneNudgeSnoozeKey } from './phoneNudge'

/** The website's 7-day, per-member snooze of the Profile card (localStorage; the app has its own in AsyncStorage). */
export function usePhoneNudgeSnooze(uid: string | null): { ready: boolean; snoozed: boolean; snooze: () => void } {
  // Keyed by member; no entry for this uid yet means not read (the card waits,
  // so it never flashes before a snooze applies).
  const [state, setState] = useState<{ uid: string; at: string | null } | null>(null)

  useEffect(() => {
    if (!uid) return
    let at: string | null = null
    try {
      at = window.localStorage.getItem(phoneNudgeSnoozeKey(uid))
    } catch {
      // Storage blocked: the card simply shows.
    }
    setState({ uid, at })
  }, [uid])

  const snooze = useCallback(() => {
    if (!uid) return
    const now = String(Date.now())
    setState({ uid, at: now })
    try {
      window.localStorage.setItem(phoneNudgeSnoozeKey(uid), now)
    } catch {
      // Not remembered across visits; hidden for now.
    }
  }, [uid])

  const current = state && state.uid === uid ? state : null
  return { ready: !uid || current !== null, snoozed: isPhoneNudgeSnoozed(current?.at ?? null), snooze }
}
