'use client'

import { useCallback, useEffect, useState, type RefObject } from 'react'
import { useLang } from '@/lib/i18n/useLang'

// Paging for a sideways scroll row, for mouse users, who have no swipe and no
// scrollbar: whether the row has more toward each end, and a page(±1). An RTL
// page starts the row from the right on its own; scrollLeft counts negative
// there in every current browser, so distances are measured from the start
// edge and paging flips its sign. Pass the row's onScroll to `measure`.
// `count` re-measures when the number of cards changes.
export function useRailPaging(railRef: RefObject<HTMLElement | null>, count: number) {
  const { isRtl } = useLang()
  const [edges, setEdges] = useState({ start: false, end: false })

  const measure = useCallback(() => {
    const rail = railRef.current
    if (!rail) return
    const fromStart = Math.abs(rail.scrollLeft)
    const max = rail.scrollWidth - rail.clientWidth
    setEdges({ start: fromStart > 1, end: fromStart < max - 1 })
  }, [railRef])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [railRef, measure, isRtl, count])

  // +1 = toward the reading-direction end.
  const page = (direction: 1 | -1) => {
    const rail = railRef.current
    if (!rail) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    rail.scrollBy({ left: direction * rail.clientWidth * 0.8 * (isRtl ? -1 : 1), behavior: smooth ? 'smooth' : 'auto' })
  }

  return { edges, measure, page, overflowing: edges.start || edges.end }
}
