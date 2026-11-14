import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'
import { isPhoneNudgeSnoozed, phoneNudgeSnoozeKey } from '@shared/profile/phoneNudge'

// The app's 7-day, per-member snooze of the Profile card (AsyncStorage; the
// website uses localStorage). Only the card hides: the Profile tab's red "1"
// stays until the phone is verified.
export function usePhoneNudgeSnooze(uid: string | null): { ready: boolean; snoozed: boolean; snooze: () => void } {
  // Keyed by member; no entry for this uid yet means not read (the card waits,
  // so it never flashes before a snooze applies).
  const [state, setState] = useState<{ uid: string; at: string | null } | null>(null)

  useEffect(() => {
    if (!uid) return
    let live = true
    AsyncStorage.getItem(phoneNudgeSnoozeKey(uid))
      .then((at) => live && setState({ uid, at }))
      .catch(() => live && setState({ uid, at: null }))
    return () => {
      live = false
    }
  }, [uid])

  const snooze = useCallback(() => {
    if (!uid) return
    const now = String(Date.now())
    setState({ uid, at: now })
    AsyncStorage.setItem(phoneNudgeSnoozeKey(uid), now).catch(() => {})
  }, [uid])

  const current = state && state.uid === uid ? state : null
  return { ready: !uid || current !== null, snoozed: isPhoneNudgeSnoozed(current?.at ?? null), snooze }
}
