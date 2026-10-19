'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** The index of the most visible item (the highest ratio above 0), or -1 when none is. */
export function mostVisibleIndex(ratios: readonly number[]): number {
  let best = -1
  let bestRatio = 0
  ratios.forEach((ratio, i) => {
    if (ratio > bestRatio) {
      bestRatio = ratio
      best = i
    }
  })
  return best
}

// Which card of a scroll-snap row is in view, for its pagination dots, and a
// way to bring one into view. An IntersectionObserver rooted on the row
// watches its children, so there's no scroll handler, and it reads the same
// in Hebrew (where scrollLeft counts negative). `count` re-observes when the
// number of children changes. scrollTo centres the card (the row snaps to
// centres), smoothly unless reduced motion is on, and never scrolls the page
// up or down (block: 'nearest').
export function useSnapIndex<T extends HTMLElement>(count: number) {
  const ref = useRef<T>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const row = ref.current
    if (!row || typeof IntersectionObserver === 'undefined') return
    const items = Array.from(row.children)
    const ratios = items.map(() => 0)
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) ratios[items.indexOf(entry.target)] = entry.intersectionRatio
        const best = mostVisibleIndex(ratios)
        if (best >= 0) setIndex(best)
      },
      { root: row, threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] },
    )
    items.forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [count])

  const scrollTo = useCallback((i: number) => {
    const item = ref.current?.children[i]
    if (!(item instanceof HTMLElement)) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    item.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', inline: 'center', block: 'nearest' })
  }, [])

  return { ref, index, scrollTo }
}
