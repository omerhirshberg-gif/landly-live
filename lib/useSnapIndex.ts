'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Where a scroll row stands: how far it has scrolled from its start edge, and its sizes. */
export interface SnapRowState {
  /** Distance scrolled from the start edge, in px: always positive, in either direction. */
  scrolled: number
  clientWidth: number
  scrollWidth: number
  /** The row's visible centre, and each item's centre, on the same (viewport) axis. */
  viewCentre: number
  itemCentres: readonly number[]
}

/**
 * The item a scroll-snap row is showing: the one whose centre is nearest the
 * row's visible centre, except at either end of the scroll, where the first
 * or last item counts (the end of a row can't centre its last card, and its
 * start often shows two whole cards). -1 for an empty row.
 */
export function snapIndex({ scrolled, clientWidth, scrollWidth, viewCentre, itemCentres }: SnapRowState): number {
  const n = itemCentres.length
  if (n === 0) return -1
  // Nothing to scroll (a grid, or a row that fits): the first item.
  if (scrollWidth - clientWidth <= 1 || scrolled <= 1) return 0
  if (scrolled + clientWidth >= scrollWidth - 1) return n - 1
  let best = 0
  for (let i = 1; i < n; i++) {
    if (Math.abs(itemCentres[i] - viewCentre) < Math.abs(itemCentres[best] - viewCentre)) best = i
  }
  return best
}

// Which card of a scroll-snap row is in view, for its pagination dots, and a
// way to bring one into view. Measured from the cards' own boxes against the
// row's (getBoundingClientRect), so it reads the same left-to-right and in
// Hebrew, where scrollLeft counts negative; only its size is used, to find the
// two ends. Read once per frame while the row scrolls, and again on resize.
// `count` re-measures when the number of children changes. scrollTo centres
// the card (the row snaps to centres), smoothly unless reduced motion is on,
// and never scrolls the page up or down (block: 'nearest').
export function useSnapIndex<T extends HTMLElement>(count: number) {
  const ref = useRef<T>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const row = ref.current
    if (!row) return
    let frame = 0
    const measure = () => {
      frame = 0
      const box = row.getBoundingClientRect()
      const next = snapIndex({
        scrolled: Math.abs(row.scrollLeft),
        clientWidth: row.clientWidth,
        scrollWidth: row.scrollWidth,
        viewCentre: box.left + box.width / 2,
        itemCentres: Array.from(row.children, (item) => {
          const r = item.getBoundingClientRect()
          return r.left + r.width / 2
        }),
      })
      if (next >= 0) setIndex(next)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    row.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      row.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [count])

  const scrollTo = useCallback((i: number) => {
    const item = ref.current?.children[i]
    if (!(item instanceof HTMLElement)) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    item.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', inline: 'center', block: 'nearest' })
  }, [])

  return { ref, index, scrollTo }
}
