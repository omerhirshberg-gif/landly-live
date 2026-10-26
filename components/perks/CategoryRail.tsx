'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { categoryHref } from '@/lib/perks/perksFilter'
import { CATEGORY_TILES } from '@/lib/categories'
import CategoryIcon from '@/components/ui/CategoryIcon'

// Home's quick category scroller: fine-line glyph tiles (CategoryIcon) with short labels, sized
// so four sit fully in view on a 393px phone with the fifth peeking. Ends with
// "View all" (/categories). Scrolls with faded edges on phones, wraps from sm.
export default function CategoryRail() {
  const { t } = useLang()
  return (
    <ul className="edge-fade -mx-4 px-4 sm:mx-0 sm:px-0 flex gap-3 overflow-x-auto sm:flex-wrap snap-x scroll-px-4 sm:scroll-px-0 pb-1 [scrollbar-width:none]">
      {CATEGORY_TILES.map((tile) => (
        <li key={tile.category} className="snap-start flex-shrink-0">
          <Link href={categoryHref(tile.category)} className="rail-tile group">
            <span aria-hidden="true" className="rail-tile-icon">
              <CategoryIcon category={tile.category} className="h-[22px] w-[22px]" />
            </span>
            <span className="rail-tile-label">{t(tile.labelKey)}</span>
          </Link>
        </li>
      ))}
      <li className="snap-start flex-shrink-0">
        <Link href="/categories" className="rail-tile group">
          <span aria-hidden="true" className="rail-tile-icon !border-transparent !bg-brand !text-white">
            <ArrowRight aria-hidden="true" className="h-5 w-5 rtl:-scale-x-100" strokeWidth={2} />
          </span>
          <span className="rail-tile-label !text-brand">{t('cats_view_all')}</span>
        </Link>
      </li>
    </ul>
  )
}
