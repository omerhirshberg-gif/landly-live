'use client'

import BrandMedia from '@/components/ui/BrandMedia'
import { memo, useMemo } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { OfferDocument } from '@/lib/firebase/offers'
import { localizedBusinessName } from '@/lib/business/businessText'
import { isolateLtr } from '@/lib/home/superShowcase'
import { useLang } from '@/lib/i18n/useLang'
import { logoWallOffers } from '@/lib/home/logoWall'
import { RAAYONIT_HUB, webOfferPath } from '@/lib/offers/offerRoutes'
import { roundedCount } from '@/lib/offers/raayonitPreview'

// Tiles load eagerly (BrandMedia `eager`): at most 24 small logos, and a lazy <img> inside the drifting, masked, overflow-hidden rail (or a
// horizontal scroller) can fail to load on iOS Safari / WebKit webviews (no intersection report), which leaves grey, unpainted tiles.
// Home's "Where your card works" (native: landly-mobile/src/components/BrandLogoWall.tsx): a strip of real chain logos on white tiles, as a
// gift-card shop shows where its card is accepted. A tile opens that chain's page; the header's link opens the hub. Nothing renders without logos.
export default memo(function BrandLogoWall({ offers, rail = false, title, byBranches = false }: { offers: OfferDocument[]; rail?: boolean; title?: string; byBranches?: boolean }) {
  const { t, lang } = useLang()
  const tiles = useMemo(() => logoWallOffers(offers, byBranches), [offers, byBranches])
  if (tiles.length < 4) return null
  return (
    <section aria-labelledby="logo-wall-title" className={`mx-auto w-full ${rail ? '' : 'max-w-6xl'}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="logo-wall-title" className="min-w-0 text-lg font-extrabold tracking-tight text-ink sm:text-xl">{title ?? t('home_logo_wall_title')}</h2>
        {!rail && (
          <Link href={RAAYONIT_HUB} className="-me-1 flex min-h-11 shrink-0 items-center gap-0.5 rounded-lg px-1 text-sm font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [@media(hover:hover)]:hover:underline">
            <span>{t('businesses_see_all').replace('{count}+', isolateLtr(`${roundedCount(offers.length)}+`))}</span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
          </Link>
        )}
      </div>
      {rail ? (
        // A drifting rail of the brands across the whole box: two identical copies slide by half the track, so the loop has no seam.
        // It pauses on hover and is a plain scrollable row under Reduce Motion (globals.css .logo-rail); the second copy is for show only.
        <div className="logo-rail -mx-4 mt-2 py-1 sm:-mx-8">
          <div className="logo-rail-track">
            {[false, true].map((copy) => (
              <ul key={String(copy)} aria-hidden={copy || undefined} className="logo-rail-copy">
              {tiles.map((o) => (
                <li key={o.id} className="shrink-0">
                  <Link href={webOfferPath(o.id)} tabIndex={copy ? -1 : undefined} aria-label={localizedBusinessName(o, lang).text} className="relative block h-[72px] w-[104px] overflow-hidden rounded-2xl border border-slate-200/80 bg-[#EEF2F7] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:h-20 sm:w-[132px] [@media(hover:hover)]:hover:-translate-y-0.5">
                    <BrandMedia src={o.imageUrl} cover={o.logoKind === 'photo'} inset="p-2.5" eager />
                  </Link>
                </li>
              ))}
              </ul>
            ))}
          </div>
        </div>
      ) : (
      <ul className="-mx-4 mt-2 flex gap-2.5 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {tiles.map((o) => (
            <li key={o.id} className="shrink-0">
              <Link href={webOfferPath(o.id)} aria-label={localizedBusinessName(o, lang).text} className="relative block h-[72px] w-[104px] overflow-hidden rounded-2xl border border-slate-200/80 bg-[#EEF2F7] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:h-20 sm:w-[132px] [@media(hover:hover)]:hover:-translate-y-0.5">
                <BrandMedia src={o.imageUrl} cover={o.logoKind === 'photo'} inset="p-2.5" eager />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
})
