'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import type { OfferDocument } from '@/lib/firebase/offers'
import { useLang } from '@/lib/i18n/useLang'
import OfferTile from './OfferTile'

// One of the /categories highlight rails (New on Landly, Best Sellers, stacked
// above the category grid): a heading row with "See more", then the perks as
// compact OfferTiles in one row that scrolls sideways. Momentum swipe on
// phones, snapping to a card's start; the rail bleeds through the page's
// 16px gutter on phones so cards scroll out from under the edge, and the
// scrollbar is hidden (wheel, trackpad, keyboard and touch still scroll it).
// From 640px with a real mouse, two chevrons in the heading row page it,
// fading out at either end. An RTL page fills and starts it from the right
// on its own; scrollLeft counts negative there, so distances are measured
// from the start edge and paging flips its sign.
export default function OfferTileRail({
  emoji,
  title,
  offers,
  href,
  seeMore,
}: {
  emoji: string
  title: string
  offers: OfferDocument[]
  href?: string
  seeMore?: string
}) {
  const { isRtl } = useLang()
  const headingId = useId()
  const railRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  const measure = useCallback(() => {
    const rail = railRef.current
    if (!rail) return
    const fromStart = Math.abs(rail.scrollLeft)
    const max = rail.scrollWidth - rail.clientWidth
    setEdges({ start: fromStart > 1, end: fromStart < max - 1 })
  }, [])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [measure, isRtl, offers.length])

  // +1 = toward the reading-direction end.
  const page = (direction: 1 | -1) => {
    const rail = railRef.current
    if (!rail) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    rail.scrollBy({ left: direction * rail.clientWidth * 0.8 * (isRtl ? -1 : 1), behavior: smooth ? 'smooth' : 'auto' })
  }

  const overflowing = edges.start || edges.end

  return (
    <section aria-labelledby={headingId} className="py-5 first:pt-0 last:pb-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={headingId} className="flex min-w-0 items-center gap-2 text-base font-bold text-slate-900">
          <span className="text-xl" aria-hidden="true">{emoji}</span>
          <span className="truncate">{title}</span>
        </h2>
        <div className="flex flex-shrink-0 items-center gap-2">
          {href && seeMore && (
            <Link href={href} className="tap-target inline-flex items-center text-sm font-bold text-brand hover:underline">
              {seeMore}
            </Link>
          )}
          {/* Mouse users have no swipe and no scrollbar: these page the rail. Hidden from AT (the cards are all in the tab order). */}
          {overflowing && (
            <>
              <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => page(-1)} data-hidden={!edges.start || undefined} className="tile-rail-arrow">
                <i className="fa-solid fa-chevron-left rtl:-scale-x-100" aria-hidden="true"></i>
              </button>
              <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => page(1)} data-hidden={!edges.end || undefined} className="tile-rail-arrow">
                <i className="fa-solid fa-chevron-right rtl:-scale-x-100" aria-hidden="true"></i>
              </button>
            </>
          )}
        </div>
      </div>
      <div
        ref={railRef}
        onScroll={measure}
        className="offer-tile-rail scrollbar-none edge-fade -mx-4 grid grid-flow-col auto-cols-[256px] gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-4 px-4 pb-1 sm:mx-0 sm:auto-cols-[272px] sm:gap-4 sm:scroll-px-0 sm:px-0"
      >
        {offers.map((offer) => (
          <OfferTile key={offer.id} offer={offer} />
        ))}
      </div>
    </section>
  )
}
