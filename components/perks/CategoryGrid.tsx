'use client'

import Link from 'next/link'
import Reveal from '@/components/ui/Reveal'
import { useLang } from '@/lib/i18n/useLang'
import { categoryHref } from '@/lib/perks/perksFilter'
import { perksCountLabel, type CategoryTile } from '@/lib/categories'

// The category discovery grid: 2 columns on phones, 3 from 600px (an unfolded
// foldable and up; lib/layout/foldable.ts). Each card
// selects that category's chip on /categories. `counts` is null while offers load, which
// shows a placeholder pill in place of the status badge. Cards sit on the
// page as white tiles with a soft shadow, the category's vector icon in a brand-tint box, the
// count as a brand pill with a live dot (or a slate "Coming soon" pill), and
// an arrow at the end that nudges 3px toward the reading direction on hover
// (.cat-card-nudge in globals.css). With a real pointer a hovered card lifts
// 6px and grows 1.5% under a soft brand shadow, so a tap never leaves a card
// raised; a press springs to 99%. Cards below the
// fold rise in as they're reached, staggered across a row (Reveal).
export default function CategoryGrid({ tiles, counts }: { tiles: readonly CategoryTile[]; counts: Map<string, number> | null }) {
  const { t } = useLang()
  return (
    <ul className="grid grid-cols-2 fold:grid-cols-3 gap-3 lg:gap-4 touch-pan-y touch-pinch-zoom">
      {tiles.map((tile, i) => {
        const count = counts?.get(tile.category) ?? 0
        return (
          <li key={tile.category} className="min-w-0">
            <Reveal delay={(i % 3) * 60} className="h-full">
              <Link
                href={categoryHref(tile.category)}
                className="group flex h-full flex-col items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-start shadow-sm [-webkit-tap-highlight-color:transparent] transition-[transform,border-color,box-shadow] duration-200 ease-out [@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:scale-[1.015] [@media(hover:hover)]:hover:border-brand/30 [@media(hover:hover)]:hover:shadow-[0_1px_2px_rgba(15,23,42,.05),0_20px_35px_-10px_rgba(0,56,184,0.08)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:[@media(hover:hover)]:hover:translate-y-0 motion-reduce:[@media(hover:hover)]:hover:scale-100 motion-reduce:active:scale-100"
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-brand/10 bg-brandTint text-lg text-brand transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:scale-105 motion-reduce:transition-none motion-reduce:[@media(hover:hover)]:group-hover:scale-100"
                  >
                    <i className={`fa-solid ${tile.icon}`}></i>
                  </span>
                  <span aria-hidden="true" className="cat-card-nudge mt-1 text-sm text-slate-300 transition-colors duration-200 [@media(hover:hover)]:group-hover:text-brand">
                    <i className="fa-solid fa-arrow-right rtl:-scale-x-100"></i>
                  </span>
                </span>
                <span className="flex min-w-0 max-w-full flex-col items-start gap-1.5">
                  <span className="line-clamp-2 break-words text-sm sm:text-base font-bold leading-snug text-ink">{t(tile.labelKey)}</span>
                  {!counts ? (
                    <span aria-hidden="true" className="h-5 w-24 rounded-full bg-slate-100 animate-pulse motion-reduce:animate-none" />
                  ) : count > 0 ? (
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-brand/15 bg-brandTint px-2.5 py-0.5 text-xs font-semibold leading-snug text-brand">
                      <span aria-hidden="true" className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                      <span className="min-w-0 break-words">{perksCountLabel(count, t)}</span>
                    </span>
                  ) : (
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium leading-snug text-slate-500">
                      <i className="fa-regular fa-clock flex-shrink-0 text-[10px]" aria-hidden="true"></i>
                      <span className="min-w-0 break-words">{perksCountLabel(0, t)}</span>
                    </span>
                  )}
                </span>
              </Link>
            </Reveal>
          </li>
        )
      })}
    </ul>
  )
}
