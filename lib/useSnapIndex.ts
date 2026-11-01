'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Where a scroll row stands: how far it has scrolled from its start edge, and its sizes. */
export interface SnapRowState {
  /** Distance scrolled from the start edge, in px: always positive, in either direction. */
  scrolled: number
  clientWidth: number
  scrollWidth: number
  /** Where a settled card lines up in the row, and that same point on each card, on one (viewport) axis. */
  viewAnchor: number
  itemAnchors: readonly number[]
}

export type SnapAlign = 'start' | 'center'

interface Box {
  left: number
  right: number
  width: number
}

/**
 * The points snapIndex compares, for how the row's cards snap. A centre-snapped
 * row compares centres; a start-snapped row compares each card's reading-start
 * edge with the row's, inside its scroll padding, because on a wide screen the
 * card after a settled one is the nearer to the row's centre.
 */
export function snapAnchors(row: Box, items: readonly Box[], { align, rtl, startPadding }: { align: SnapAlign; rtl: boolean; startPadding: number }) {
  if (align === 'center') {
    const centre = (box: Box) => box.left + box.width / 2
    return { viewAnchor: centre(row), itemAnchors: items.map(centre) }
  }
  return rtl
    ? { viewAnchor: row.right - startPadding, itemAnchors: items.map((item) => item.right) }
    : { viewAnchor: row.left + startPadding, itemAnchors: items.map((item) => item.left) }
}

const snapAlignOf = (row: HTMLElement): SnapAlign => {
  const first = row.children[0]
  // Computed as one value or two (block, inline): the last is the inline axis.
  return first && getComputedStyle(first).scrollSnapAlign.trim().split(/\s+/).pop() === 'start' ? 'start' : 'center'
}

/**
 * The item a scroll-snap row is showing: the one whose anchor is nearest the
 * row's (snapAnchors), except at either end of the scroll, where the first or
 * last item counts (the end of a row can't settle its last card, and its start
 * often shows two whole cards). -1 for an empty row.
 */
export function snapIndex({ scrolled, clientWidth, scrollWidth, viewAnchor, itemAnchors }: SnapRowState): number {
  const n = itemAnchors.length
  if (n === 0) return -1
  // Nothing to scroll (a grid, or a row that fits): the first item.
  if (scrollWidth - clientWidth <= 1 || scrolled <= 1) return 0
  if (scrolled + clientWidth >= scrollWidth - 1) return n - 1
  let best = 0
  for (let i = 1; i < n; i++) {
    if (Math.abs(itemAnchors[i] - viewAnchor) < Math.abs(itemAnchors[best] - viewAnchor)) best = i
  }
  return best
}

// Which card of a scroll-snap row is in view, for its pagination dots, and a
// way to bring one into view. Measured from the cards' own boxes against the
// row's (getBoundingClientRect), so it reads the same left-to-right and in
// Hebrew, where scrollLeft counts negative; only its size is used, to find the
// two ends. Read once per frame while the row scrolls, and again on resize.
// `count` re-measures when the number of children changes. scrollTo lines the
// card up the way the row snaps, start or centre, smoothly unless reduced
// motion is on, and never scrolls the page up or down (block: 'nearest').
export function useSnapIndex<T extends HTMLElement>(count: number) {
  const ref = useRef<T>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const row = ref.current
    if (!row) return
    let frame = 0
    const measure = () => {
      frame = 0
      const style = getComputedStyle(row)
      const anchors = snapAnchors(row.getBoundingClientRect(), Array.from(row.children, (item) => item.getBoundingClientRect()), {
        align: snapAlignOf(row),
        rtl: style.direction === 'rtl',
        startPadding: parseFloat(style.scrollPaddingInlineStart) || 0,
      })
      const next = snapIndex({
        scrolled: Math.abs(row.scrollLeft),
        clientWidth: row.clientWidth,
        scrollWidth: row.scrollWidth,
        ...anchors,
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
    const row = ref.current
    const item = row?.children[i]
    if (!row || !(item instanceof HTMLElement)) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    item.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', inline: snapAlignOf(row), block: 'nearest' })
  }, [])

  return { ref, index, scrollTo }
}
