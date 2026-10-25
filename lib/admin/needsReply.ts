import { useEffect, useState } from 'react'
import { adminFetch, isSignedIn } from './adminSession'

// How many WhatsApp chats are waiting for the team, for the badges on the
// header's ☰ and the "WhatsApp Support" nav item. Polled every POLL_MS
// (paused while the tab is hidden, refreshed when it shows again) from
// /api/admin/whatsapp/conversations?summary=1. The support inbox, which
// already knows the count from its own list (and lowers it the moment the
// team replies or resolves), announces it with NEEDS_REPLY_EVENT. While it
// is open the badges only follow those announcements: a summary fetched
// before a reply landed would otherwise put the old count back.

export const POLL_MS = 30_000
export const NEEDS_REPLY_EVENT = 'landly-admin:needs-reply'

/** "7", or "99+" past 99: what the badge shows. */
export const formatBadgeCount = (count: number) => (count > 99 ? '99+' : String(count))

/** Tells the badges the current count (detail), or asks them to refetch (no detail). */
export function announceNeedsReply(count?: number): void {
  window.dispatchEvent(new CustomEvent(NEEDS_REPLY_EVENT, { detail: count }))
}

/** `follow`: the support inbox is open, so take its announcements instead of polling. */
export function useNeedsReplyCount(enabled: boolean, { follow = false }: { follow?: boolean } = {}): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const load = () => {
      // Signed out (or the gate hasn't let us in yet): nothing to ask, and no 401 redirect from here.
      if (follow || document.hidden || !isSignedIn()) return
      adminFetch('/api/admin/whatsapp/conversations?summary=1')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && typeof data?.needsReplyCount === 'number') setCount(data.needsReplyCount)
        })
        .catch(() => {})
    }
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail
      if (typeof detail === 'number') setCount(detail)
      else load()
    }
    load()
    const timer = follow ? undefined : setInterval(load, POLL_MS)
    document.addEventListener('visibilitychange', load)
    window.addEventListener(NEEDS_REPLY_EVENT, onAnnounce)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', load)
      window.removeEventListener(NEEDS_REPLY_EVENT, onAnnounce)
    }
  }, [enabled, follow])

  return enabled ? count : 0
}
