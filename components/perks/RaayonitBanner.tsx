'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { BANNER_INTERVAL_MS, BANNER_SLIDES, nextSlide } from '@/lib/home/raayonitBanner'
import { useLang } from '@/lib/i18n/useLang'
import { RAAYONIT_HUB } from '@/lib/offers/offerRoutes'

// Home's entry to the Raayonit Card tab (native: landly-mobile/src/components/RaayonitBanner.tsx): a wide rounded carousel of benefit-led photo slides,
// each one a link to the tab. It advances by itself every few seconds and stops while hovered, focused, paused with the 44px button, and always under
// Reduce Motion (WCAG 2.2.2). Arrows from `sm`, dots and swiping everywhere; the order and arrows mirror in Hebrew.
// Bare white glyphs, no capsule: a 44px hit area around a 20px icon.
const BTN = 'flex h-11 w-11 items-center justify-center text-white drop-shadow-[0_1px_3px_rgb(0,0,0,0.55)] transition-opacity duration-300 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-6px] focus-visible:outline-white motion-reduce:transition-none'

export default function RaayonitBanner() {
  const { t } = useLang()
  const railRef = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [held, setHeld] = useState(false)
  const [reduce, setReduce] = useState(false)
  const total = BANNER_SLIDES.length

  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduce(q.matches)
    sync()
    q.addEventListener('change', sync)
    return () => q.removeEventListener('change', sync)
  }, [])

  const goTo = useCallback((i: number, smooth = true) => {
    // scrollIntoView follows the writing direction (a Hebrew row starts at the right), which a computed scrollLeft would not.
    const slide = railRef.current?.children[i] as HTMLElement | undefined
    slide?.scrollIntoView({ behavior: smooth && !reduce ? 'smooth' : 'auto', inline: 'center', block: 'nearest' })
  }, [reduce])

  const onScroll = () => {
    const el = railRef.current
    if (!el || el.clientWidth === 0) return
    setIndex(Math.min(total - 1, Math.max(0, Math.round(Math.abs(el.scrollLeft) / el.clientWidth))))
  }

  useEffect(() => {
    if (paused || held || reduce) return
    const id = window.setTimeout(() => goTo(nextSlide(index, total)), BANNER_INTERVAL_MS)
    return () => window.clearTimeout(id)
  }, [index, paused, held, reduce, goTo, total])

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={t('chains_banner_label')}
      className="relative mt-4"
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHeld(true) }}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <ul ref={railRef} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-3xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {BANNER_SLIDES.map((slide, i) => (
          <li key={slide.key} role="group" aria-roledescription="slide" aria-label={t('chains_banner_go').replace('{n}', String(i + 1)).replace('{total}', String(total))} aria-hidden={i !== index || undefined} className="w-full shrink-0 snap-center">
            <Link href={RAAYONIT_HUB} tabIndex={i === index ? 0 : -1} className="group relative block h-[188px] w-full overflow-hidden rounded-3xl border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:h-[216px] lg:h-[248px]">
              <img src={`/images/raayonit-banner/${slide.photo}.webp`} alt="" width={3000} height={1000} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 motion-reduce:transition-none [@media(hover:hover)]:group-hover:scale-[1.03]" />
              <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-slate-950/10 to-transparent sm:bg-gradient-to-r sm:from-slate-950/55 sm:via-slate-950/20 sm:to-transparent sm:rtl:bg-gradient-to-l" />
              <span className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-1.5 p-5 pb-12 sm:inset-y-0 sm:max-w-[58%] sm:justify-center sm:p-9 sm:pb-9">
                <span className="text-balance text-xl font-extrabold leading-tight tracking-tight text-white drop-shadow-[0_1px_4px_rgb(0,0,0,0.35)] sm:text-3xl">{t(slide.key)}</span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-white/95 underline-offset-4 group-hover:underline">
                  {t('chains_live_cta')}
                  <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="pointer-events-none absolute inset-x-2 bottom-0 flex items-center justify-between">
        <div className="pointer-events-auto flex items-center">
          {BANNER_SLIDES.map((slide, i) => (
            <button key={slide.key} type="button" aria-label={t('chains_banner_go').replace('{n}', String(i + 1)).replace('{total}', String(total))} aria-current={i === index || undefined} onClick={() => goTo(i)} className="group/dot flex h-11 w-6 items-center justify-center focus-visible:outline-none">
              <span className={`h-1.5 rounded-full bg-white shadow-[0_1px_3px_rgb(0,0,0,0.4)] transition-all duration-300 group-focus-visible/dot:ring-2 group-focus-visible/dot:ring-white/80 group-focus-visible/dot:ring-offset-1 motion-reduce:transition-none ${i === index ? 'w-5 opacity-100' : 'w-1.5 opacity-60'}`} />
            </button>
          ))}
        </div>
        <div className="pointer-events-auto flex items-center">
          <button type="button" aria-label={t('chains_banner_prev')} onClick={() => goTo(nextSlide(index, total, -1))} className={`${BTN} hidden sm:flex`}>
            <ChevronLeft aria-hidden="true" className="h-5 w-5 rtl:-scale-x-100" strokeWidth={2} />
          </button>
          <button type="button" aria-label={t('chains_banner_next')} onClick={() => goTo(nextSlide(index, total))} className={`${BTN} hidden sm:flex`}>
            <ChevronRight aria-hidden="true" className="h-5 w-5 rtl:-scale-x-100" strokeWidth={2} />
          </button>
          {!reduce && (
            <button type="button" aria-label={paused ? t('chains_banner_play') : t('chains_banner_pause')} aria-pressed={paused} onClick={() => setPaused((p) => !p)} className={BTN}>
              {paused ? <Play aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2} /> : <Pause aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
