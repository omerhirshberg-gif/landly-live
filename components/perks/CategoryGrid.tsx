'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'
import { categoryHref } from '@/lib/perks/perksFilter'
import { perksCountLabel, type CategoryTile } from '@/lib/categories'

// The category discovery grid: 2 columns on phones, 3 from 1024px. Each card
// selects that category's chip on /categories. `counts` is null while offers load, which
// shows a placeholder bar in place of the "X perks available" line.
export default function CategoryGrid({ tiles, counts }: { tiles: readonly CategoryTile[]; counts: Map<string, number> | null }) {
  const { t } = useLang()
  return (
    <ul className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 touch-pan-y touch-pinch-zoom">
      {tiles.map((tile) => (
        <li key={tile.category} className="min-w-0">
          <Link
            href={categoryHref(tile.category)}
            className="group flex h-full flex-col items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-start [-webkit-tap-highlight-color:transparent] transition-[transform,border-color,box-shadow] duration-150 ease-out hover:border-brand/30 hover:shadow-sm active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <span aria-hidden="true" className="text-[32px] leading-none">
              {tile.emoji}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="line-clamp-2 break-words text-sm sm:text-base font-bold leading-snug text-slate-900">{t(tile.labelKey)}</span>
              {counts ? (
                <span className="text-xs text-slate-500">{perksCountLabel(counts.get(tile.category) ?? 0, t)}</span>
              ) : (
                <span aria-hidden="true" className="mt-1 h-3 w-20 rounded-full bg-slate-100 animate-pulse motion-reduce:animate-none" />
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
