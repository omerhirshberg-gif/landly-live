'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Reveal from '@/components/ui/Reveal'
import IconFrame from '@/components/ui/IconFrame'
import { categoryIcon } from '@/components/ui/CategoryIcon'
import { useLang } from '@/lib/i18n/useLang'
import { categoryHref } from '@/lib/perks/perksFilter'
import type { CategoryTile } from '@/lib/categories'

// The category discovery grid: 2 columns on phones, 3 from 600px (an unfolded
// foldable and up; lib/layout/foldable.ts). Each card
// selects that category's chip on /categories. Every card is the same
// height (116px, 124px from 640px), so rows line up whatever a label's
// length: the frame and arrow at the top, the name held to the foot in a
// fixed two-line box (38px, 42px from 640px). Cards sit on the page as
// white tiles with a soft shadow: the category's fine-line glyph
// (CategoryIcon) in the shared 40px frame (IconFrame), its name (no perk
// count: a young catalogue's small numbers read as empty), and an arrow at
// the end that nudges 3px toward the reading direction on hover
// (.cat-card-nudge in globals.css). With a real pointer a hovered card lifts
// 6px and grows 1.5% under a soft brand shadow, so a tap never leaves a card
// raised; a press springs to 99%. Cards below the
// fold rise in as they're reached, staggered across a row (Reveal).
export default function CategoryGrid({ tiles }: { tiles: readonly CategoryTile[] }) {
  const { t } = useLang()
  return (
    <ul className="grid grid-cols-2 fold:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4 touch-pan-y touch-pinch-zoom">
      {tiles.map((tile, i) => (
        <li key={tile.category} className="min-w-0">
          <Reveal delay={(i % 4) * 60} className="h-full">
            <Link
              href={categoryHref(tile.category)}
              className="group flex h-[116px] sm:h-[124px] flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 text-start shadow-card [-webkit-tap-highlight-color:transparent] transition-[transform,border-color,box-shadow] duration-200 ease-out-expo [@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:scale-[1.015] [@media(hover:hover)]:hover:border-brand/30 [@media(hover:hover)]:hover:shadow-[0_1px_2px_rgba(15,23,42,.05),0_20px_35px_-10px_rgba(0,56,184,0.08)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:[@media(hover:hover)]:hover:translate-y-0 motion-reduce:[@media(hover:hover)]:hover:scale-100 motion-reduce:active:scale-100"
            >
              <span className="flex w-full items-start justify-between gap-2">
                <IconFrame
                  icon={categoryIcon(tile.category)}
                  size="sm"
                  className="transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:scale-105 motion-reduce:transition-none motion-reduce:[@media(hover:hover)]:group-hover:scale-100"
                />
                <span aria-hidden="true" className="cat-card-nudge mt-1 text-sm text-slate-300 transition-colors duration-200 [@media(hover:hover)]:group-hover:text-brand">
                  <ArrowRight className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
                </span>
              </span>
              <span className="flex h-[38px] sm:h-[42px] w-full items-end">
                <span className="line-clamp-2 min-w-0 break-words text-sm leading-[19px] sm:text-base sm:leading-[21px] font-bold text-ink">{t(tile.labelKey)}</span>
              </span>
            </Link>
          </Reveal>
        </li>
      ))}
    </ul>
  )
}
