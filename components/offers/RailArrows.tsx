'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { railState, railStep } from '@/lib/offers/railScroll'

// Desktop paging for a horizontal rail, kept in the section's header row so the arrows never sit on the cards. Two 36px buttons, shown
// only where a real mouse is the pointer (hover: hover, from md) and only when the row overflows. The leading one dims at the start and
// the trailing one at the end, in either reading direction (scrollLeft runs negative in RTL). Phones keep the touch swipe.
export function useRail<T extends HTMLElement>(dep: unknown) {
  const { isRtl } = useLang()
  const ref = useRef<T>(null)
  const [edge, setEdge] = useState({ atStart: true, atEnd: false, overflow: false })
  const measure = useCallback(() => {
    const el = ref.current
    if (el) setEdge({ ...railState(el), overflow: el.scrollWidth > el.clientWidth + 2 })
  }, [])
  useEffect(() => {
    measure()
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, dep])
  const page = useCallback((way: 'next' | 'prev') => {
    const el = ref.current
    if (el) el.scrollBy({ left: railStep(el, isRtl, way), behavior: 'smooth' })
  }, [isRtl])
  return { ref, edge, measure, page }
}

const BUTTON = 'hidden h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-40 [@media(hover:hover)]:md:flex'

export default function RailArrows({ edge, page }: { edge: { atStart: boolean; atEnd: boolean; overflow: boolean }; page: (way: 'next' | 'prev') => void }) {
  const { t, isRtl } = useLang()
  if (!edge.overflow) return null
  const Prev = isRtl ? ChevronRight : ChevronLeft
  const Next = isRtl ? ChevronLeft : ChevronRight
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => page('prev')} disabled={edge.atStart} aria-label={t('brands_scroll_prev')} data-rail-arrow="prev" className={BUTTON}><Prev aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} /></button>
      <button type="button" onClick={() => page('next')} disabled={edge.atEnd} aria-label={t('brands_scroll_next')} data-rail-arrow="next" className={BUTTON}><Next aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} /></button>
    </div>
  )
}
