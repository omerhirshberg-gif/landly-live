// Where the settings pages go back to, and the rules of the swipe that does
// it (components/settings/SettingsPageShell.tsx, useSwipeBack.ts). Pure, so
// the hierarchy and the gesture thresholds are tested on their own.

/**
 * A settings sub-page's parent: one level up the URL
 * (/settings/language-region/origin -> /settings/language-region,
 * /settings/privacy-security -> /settings), or null for /settings itself.
 */
export function settingsParent(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '')
  if (!path.startsWith('/settings/')) return null
  return path.slice(0, path.lastIndexOf('/'))
}

/**
 * Pages whose Edit buttons open a settings sub-page as a detour (/profile's
 * country of origin and region): back from that sub-page returns to them
 * rather than climbing to its parent, matching the app, where those screens
 * open without the Settings menu under them.
 */
export const SETTINGS_EDIT_OPENERS: readonly string[] = ['/profile']

export type BackAction = { kind: 'back' } | { kind: 'replace'; href: string } | { kind: 'push'; href: string }

/**
 * What back does. A sub-page always lands on its parent: through the
 * browser's back when that's the page below it in history (scroll and
 * history stay intact), otherwise by replacing this page with the parent, so
 * it never pops out to wherever the member came from — except to an Edit
 * opener (SETTINGS_EDIT_OPENERS), which it returns to. /settings itself goes
 * back to the previous in-app page, or home when it was opened directly.
 */
export function settingsBackAction(parent: string | null, previous: string | null): BackAction {
  if (parent) {
    if (previous === parent || (previous !== null && SETTINGS_EDIT_OPENERS.includes(previous))) return { kind: 'back' }
    return { kind: 'replace', href: parent }
  }
  return previous ? { kind: 'back' } : { kind: 'push', href: '/' }
}

// ── Swipe ───────────────────────────────────────────────────────────────
/** The outer strips left to the browser and the OS (iOS Safari's edge swipe, Android's back gesture). */
export const SWIPE_EDGE_PX = 24
/** Movement before the gesture picks an axis. */
export const SWIPE_SLOP_PX = 10
/** Released past this share of the width, the page turns. */
export const SWIPE_COMMIT_RATIO = 1 / 3
/** A flick this fast (px/ms) turns it from a shorter drag. */
export const SWIPE_FLICK_VELOCITY = 0.5
export const SWIPE_FLICK_MIN_PX = 40

/** +1 when back is a swipe to the right (left-to-right languages), -1 in Hebrew. */
export function swipeSign(isRtl: boolean): 1 | -1 {
  return isRtl ? -1 : 1
}

/** A touch starting in either edge strip belongs to the browser or the OS, never to the page. */
export function isEdgeStart(x: number, width: number): boolean {
  return x < SWIPE_EDGE_PX || x > width - SWIPE_EDGE_PX
}

/**
 * The axis once the finger has moved past the slop: 'back' for a mostly
 * sideways move toward back, 'other' for anything else (vertical scrolling,
 * or sideways the wrong way), null while still undecided.
 */
export function swipeAxis(dx: number, dy: number, isRtl: boolean): 'back' | 'other' | null {
  if (Math.abs(dx) < SWIPE_SLOP_PX && Math.abs(dy) < SWIPE_SLOP_PX) return null
  return Math.abs(dx) > Math.abs(dy) * 1.2 && dx * swipeSign(isRtl) > 0 ? 'back' : 'other'
}

/** On release: turn the page (go back) or let it spring back. `distance` is along the back direction. */
export function shouldCommitSwipe(distance: number, width: number, velocity: number): boolean {
  return distance > width * SWIPE_COMMIT_RATIO || (velocity > SWIPE_FLICK_VELOCITY && distance > SWIPE_FLICK_MIN_PX)
}
