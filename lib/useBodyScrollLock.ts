'use client'

import { useEffect } from 'react'

// The page behind a drawer or sheet doesn't scroll while it's up. WebKit stops
// touch scrolling of the whole page for as long as <body> is overflow:hidden,
// so a lock left behind freezes it (iOS in-app browsers have no address bar or
// reload to escape with). The locks are counted, so two overlapping ones can't
// release each other early, and each is dropped when its owner unmounts, even
// if it leaves mid-open (an edge swipe back with the drawer up).
let holders = 0
let previousOverflow = ''

function acquire(body: HTMLElement) {
  if (holders === 0) {
    previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'
  }
  holders += 1
}

function release(body: HTMLElement) {
  holders = Math.max(0, holders - 1)
  if (holders === 0) body.style.overflow = previousOverflow
}

/** Takes one lock on <body> and returns its release; exported for the tests. */
export function lockBodyScroll(body: HTMLElement): () => void {
  acquire(body)
  let released = false
  return () => {
    if (released) return
    released = true
    release(body)
  }
}

/** Locks the page's scroll while `active`; always released on unmount. */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    return lockBodyScroll(document.body)
  }, [active])
}
