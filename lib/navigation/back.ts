// What a page's back button does (components/navigation/BackButton.tsx).
// Pure, so it's tested on its own; settings pages keep their own hierarchy
// rule (settingsBack.ts) on the same BackAction type.

export type BackAction = { kind: 'back' } | { kind: 'replace'; href: string } | { kind: 'push'; href: string }

/**
 * With an in-app page below this one, the browser's back -- so the button,
 * the browser's own back and the edge swipe all land in the same place, with
 * scroll intact. Opened directly (a shared link, a reload), the page is
 * replaced by `fallback`, so back never leaves the site. `force` always goes
 * to `fallback` (the checkout success page must never step back into payment).
 */
export function backAction(fallback: string, previous: string | null, force = false): BackAction {
  if (!force && previous !== null) return { kind: 'back' }
  return { kind: 'replace', href: fallback }
}

/**
 * The back button's text for the page it returns to, so an offer opened from
 * Home says "Back to Home" rather than naming a page the member never saw.
 * Opened directly (no in-app page behind it), just "Back".
 */
export function backLabelKey(previous: string | null): 'nav_back_home' | 'offer_detail_back' | 'nav_back_wishlist' | 'nav_back' {
  if (previous === null) return 'nav_back'
  const path = previous.split(/[?#]/)[0]
  if (path === '/') return 'nav_back_home'
  if (path === '/categories' || path.startsWith('/categories/')) return 'offer_detail_back'
  if (path === '/wishlist') return 'nav_back_wishlist'
  return 'nav_back'
}
