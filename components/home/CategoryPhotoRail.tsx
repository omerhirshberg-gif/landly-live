'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { RailArrows } from '@/components/discover/OfferCardRail'
import { LANDING_COLUMN, LANDING_RAIL } from '@/components/landing/landingColumn'
import { CATEGORY_TILES } from '@/lib/categories'
import { useLang } from '@/lib/i18n/useLang'
import { categoryHref } from '@/lib/perks/perksFilter'
import { useRailPaging } from '@/lib/useRailPaging'

// "Top categories": every official category as a lifestyle photo (bundled in
// public/categories, so nothing hangs on a remote host) in a 16:10 card, a dark
// gradient on its lower half only and its name in white at the foot, each opening that category on
// /categories. One sideways row that snaps to its cards; with a real mouse,
// arrows page it. It reaches the screen's edges (.member-bleed) like every
// member rail; `contained` puts it on the landing's column, its first card on
// the headings' line, and it bleeds through the gutter from there. A dark card sits
// behind each photo, so a photo that fails still carries its white label.
// Same row as the Expo app's components/CategoryPhotoRail.tsx.
export default function CategoryPhotoRail({ contained = false }: { contained?: boolean }) {
  const { t } = useLang()
  const railRef = useRef<HTMLUListElement>(null)
  const { edges, measure, page, overflowing } = useRailPaging(railRef, CATEGORY_TILES.length)

  return (
    <nav aria-label={t('cats_category_label')} className={`offer-rail relative ${contained ? LANDING_COLUMN : ''}`}>
      <ul ref={railRef} onScroll={measure} className={`${contained ? LANDING_RAIL : 'member-bleed'} edge-fade flex gap-3 overflow-x-auto touch-pan-x touch-pan-y touch-pinch-zoom overscroll-x-contain snap-x snap-mandatory scrollbar-none py-1 [-webkit-overflow-scrolling:touch] sm:gap-4`}>
        {CATEGORY_TILES.map((tile) => (
          <li key={tile.category} className="flex-shrink-0 snap-start">
            <Link
              href={categoryHref(tile.category)}
              className="relative block h-[110px] w-[176px] overflow-hidden rounded-2xl bg-slate-700 shadow-card transition-transform duration-200 ease-out-expo [-webkit-tap-highlight-color:transparent] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:active:scale-100 sm:h-[150px] sm:w-[240px] [@media(hover:hover)]:hover:-translate-y-0.5 motion-reduce:[@media(hover:hover)]:hover:translate-y-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/categories/${tile.photo}.webp`} alt="" width={960} height={600} loading="lazy" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover object-center" />
              <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 line-clamp-2 p-3 text-start text-sm font-bold leading-snug tracking-tight text-white sm:p-4 sm:text-base">{t(tile.labelKey)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {overflowing && <RailArrows edges={edges} page={page} />}
    </nav>
  )
}

// The rail's heading, apart from it: the member home sets it on its column while the rail reaches the screen's edges.
export function CategoryPhotoTitle({ id, className }: { id: string; className: string }) {
  const { t } = useLang()
  return <h2 id={id} className={className}>{t('home_top_categories')}</h2>
}
