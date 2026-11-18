// Direction-aware paging for a horizontal rail (the participating-chains row's desktop arrows). Browsers count scrollLeft from the
// start edge: 0 at rest, negative in a right-to-left box. `distance` is how far the rail has moved toward its end, either way.
export interface RailMetrics { scrollLeft: number; clientWidth: number; scrollWidth: number }

export function railState(m: RailMetrics): { atStart: boolean; atEnd: boolean } {
  const distance = Math.abs(m.scrollLeft)
  return { atStart: distance <= 2, atEnd: distance + m.clientWidth >= m.scrollWidth - 2 }
}

/** The `left` offset for scrollBy: one page (85% of the visible width) toward the end ('next') or the start ('prev'). */
export function railStep(m: RailMetrics, rtl: boolean, way: 'next' | 'prev'): number {
  const page = Math.max(120, Math.round(m.clientWidth * 0.85))
  const toEnd = rtl ? -page : page
  return way === 'next' ? toEnd : -toEnd
}
