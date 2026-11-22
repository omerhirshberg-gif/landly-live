'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { OfferDocument } from '@/lib/firebase/offers'
import { categoryExperiences } from '@/lib/home/categoryExperiences'
import { isolateLtr } from '@/lib/home/superShowcase'
import { useLang } from '@/lib/i18n/useLang'
import { raayonitCategoryName } from '@/lib/offers/raayonitCategories'
import { raayonitHubPath, RAAYONIT_HUB } from '@/lib/offers/offerRoutes'
import { roundedCount } from '@/lib/offers/raayonitPreview'
import { railState, railStep } from '@/lib/offers/railScroll'

// Home's "Explore by category" (native: landly-mobile/src/components/RaayonitCategoryRail.tsx): Raayonit's categories as photo cards
// (self-hosted category photo, dark lower scrim, white title, live venue count). A card opens /raayonit?category=<id>; the header's text
// link opens the whole catalogue. Categories with no live venue are left out. From lg two round step buttons sit beside the link.
export default memo(function RaayonitCategoryRail({ offers }: { offers: OfferDocument[] }) {
  const { t, lang } = useLang()
  const cards = useMemo(() => categoryExperiences(offers, lang), [offers, lang])
  const ref = useRef<HTMLUListElement>(null)
  const [edge, setEdge] = useState({ atStart: true, atEnd: true })
  const update = useCallback(() => {
    const el = ref.current
    if (el) setEdge(railState(el))
  }, [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [update, cards.length])
  const step = (way: 'next' | 'prev') => {
    const el = ref.current
    if (el) el.scrollBy({ left: railStep(el, getComputedStyle(el).direction === 'rtl', way), behavior: 'smooth' })
  }
  if (cards.length === 0) return null
  const label = t('home_explore_category')
  const btn = 'hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-ink shadow-sm transition-opacity hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-30 lg:flex'
  return (
    <section aria-labelledby="category-rail-title" className="mx-auto w-full max-w-6xl">
      <div className="flex items-center justify-between gap-3">
        <h2 id="category-rail-title" className="min-w-0 text-lg font-extrabold tracking-tight text-ink sm:text-xl">{label}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={RAAYONIT_HUB} className="-me-1 flex min-h-11 shrink-0 items-center gap-0.5 rounded-lg px-1 text-sm font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [@media(hover:hover)]:hover:underline">
            <span>{t('businesses_see_all').replace('{count}+', isolateLtr(`${roundedCount(offers.length)}+`))}</span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
          </Link>
          <button type="button" aria-label={label} tabIndex={-1} disabled={edge.atStart} onClick={() => step('prev')} className={`${btn} ms-2`}>
            <ChevronLeft aria-hidden="true" className="h-[18px] w-[18px] rtl:-scale-x-100" strokeWidth={2} />
          </button>
          <button type="button" aria-label={label} tabIndex={-1} disabled={edge.atEnd} onClick={() => step('next')} className={btn}>
            <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] rtl:-scale-x-100" strokeWidth={2} />
          </button>
        </div>
      </div>
      <ul ref={ref} onScroll={update} className="-mx-4 mt-2 flex snap-x gap-3 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {cards.map((c) => {
          const name = raayonitCategoryName(c.id, lang)
          return (
            <li key={c.id} className="h-[185px] w-[150px] shrink-0 snap-start lg:h-[224px] lg:w-[196px]">
              <Link href={raayonitHubPath(c.id)} aria-label={`${name}, ${c.count}`} className="group relative flex h-full w-full items-end overflow-hidden rounded-2xl bg-slate-700 shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [@media(hover:hover)]:hover:-translate-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/categories/${c.photo}.webp`} alt="" loading="lazy" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-105" />
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                <span className="relative block w-full p-3 text-start lg:p-4">
                  <bdi dir="auto" className="line-clamp-2 block text-[15px] font-extrabold leading-5 tracking-tight text-white lg:text-[17px] lg:leading-[22px]">{name}</bdi>
                  <bdi dir="ltr" className="mt-0.5 block text-[12.5px] font-semibold leading-4 text-white/85">{c.count}</bdi>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
})
