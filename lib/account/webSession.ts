'use client'

import { describeUserAgent } from './deviceName'
import { heartbeatDue, isSessionId, newSessionId } from './sessionList'
import { endSession, recordSession } from './sessions'

// This browser's row in Privacy & Security's Sessions list (the app keeps
// its own: landly-mobile/src/lib/deviceSession.ts). The id lives in
// localStorage, so each browser profile is one device; without storage
// (private mode, blocked site data) it lasts for this page only.

const ID_KEY = 'landly.session.id'
const BEAT_KEY = 'landly.session.beat'

let memoryId: string | null = null
let memoryBeat: { uid: string; at: number } | null = null

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))

export function webSessionId(): string {
  try {
    const stored = localStorage.getItem(ID_KEY)
    if (isSessionId(stored)) return stored
    const id = newSessionId(randomBytes)
    localStorage.setItem(ID_KEY, id)
    return id
  } catch {
    memoryId ??= newSessionId(randomBytes)
    return memoryId
  }
}

export function webSessionName(): string {
  return describeUserAgent(navigator.userAgent, navigator.maxTouchPoints ?? 0)
}

function lastBeat(uid: string): number | null {
  try {
    const [who, at] = (localStorage.getItem(BEAT_KEY) ?? '').split(':')
    return who === uid && Number(at) ? Number(at) : null
  } catch {
    return memoryBeat?.uid === uid ? memoryBeat.at : null
  }
}

function setLastBeat(uid: string, at: number | null) {
  memoryBeat = at === null ? null : { uid, at }
  try {
    if (at === null) localStorage.removeItem(BEAT_KEY)
    else localStorage.setItem(BEAT_KEY, `${uid}:${at}`)
  } catch {}
}

/** Marks this browser active, at most once per SESSION_HEARTBEAT_MS across its tabs. */
export async function beatWebSession(uid: string): Promise<void> {
  const now = Date.now()
  if (!heartbeatDue(lastBeat(uid), now)) return
  setLastBeat(uid, now)
  const ok = await recordSession(uid, webSessionId(), { deviceName: webSessionName(), platform: 'web' })
  if (!ok) setLastBeat(uid, null)
}

/** "Sign out of all devices" cleared the list: write this browser's row again on its next sign-in. */
export function forgetWebSessionBeat() {
  setLastBeat('', null)
}

/** Signing out of this browser on purpose: its row leaves the member's other devices' lists. */
export async function endWebSession(uid: string): Promise<void> {
  setLastBeat(uid, null)
  await endSession(uid, webSessionId())
}
