import { collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { parseSession, type SessionPlatform, type UserSession } from './sessionList'

// Writing and reading users/{uid}/sessions (see lib/account/sessionList.ts
// for the shape and firestore.rules for what a device may write). Shared by
// the website and the Expo app; each passes its own device id and name.

const sessionRef = (uid: string, sessionId: string) => doc(db, 'users', uid, 'sessions', sessionId)

/**
 * Marks this device active now: an update when its document exists (the
 * rules keep createdAt as first written), else a create. Read first rather
 * than relying on a failed update, which the rules would refuse before
 * Firestore could say "not found". Best effort; a member who can't write
 * (not verified yet, or a business login) is simply not listed.
 */
export async function recordSession(uid: string, sessionId: string, device: { deviceName: string; platform: SessionPlatform }): Promise<boolean> {
  const ref = sessionRef(uid, sessionId)
  const fields = { deviceName: device.deviceName, platform: device.platform, lastActiveAt: serverTimestamp() }
  try {
    const existing = await getDoc(ref)
    if (existing.exists()) await updateDoc(ref, fields)
    else await setDoc(ref, { ...fields, createdAt: serverTimestamp() })
    return true
  } catch {
    return false
  }
}

/** This device signing out on its own: its row goes from the other devices' lists. */
export async function endSession(uid: string, sessionId: string): Promise<void> {
  await deleteDoc(sessionRef(uid, sessionId)).catch(() => {})
}

/** Every listed device, live; `current` marks this one. Returns the unsubscribe. */
export function watchSessions(uid: string, currentId: string | null, onChange: (sessions: UserSession[]) => void): () => void {
  return onSnapshot(
    collection(db, 'users', uid, 'sessions'),
    (snap) => onChange(snap.docs.map((d) => parseSession(d.id, d.data(), currentId)).filter((s): s is UserSession => s !== null)),
    () => onChange([])
  )
}
