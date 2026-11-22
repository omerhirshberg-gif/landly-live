'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { OfferDocument } from '@/lib/firebase/offers'
import { isolateLtr } from '@/lib/home/superShowcase'
import { useLang } from '@/lib/i18n/useLang'
import { RAAYONIT_HUB } from '@/lib/offers/offerRoutes'
import { roundedCount } from '@/lib/offers/raayonitPreview'
import { ClubCard } from '@/components/raayonit/RaayonitHero'
import FlagshipCta from '@/components/raayonit/FlagshipCta'
import { useFlagshipPurchase } from '@/components/raayonit/useFlagshipPurchase'
import RaayonitPromoStrip from '@/components/raayonit/RaayonitPromoStrip'

// "Gift cards" on Home and Explore Perks (native: landly-mobile/src/components/GiftCardBand.tsx). Home gets the full band: the club card on a
// soft tinted surface (no white pricing box), the "Valid at 230+ chains" label, the two values and one action to the hub. Perks gets the
// compact strip. The redemption and hotel terms live on /raayonit and the offer page, not here.
export default function GiftCardBand({ offer, count, compact = false }: { offer: OfferDocument | null; count: number; compact?: boolean }) {
  const { t } = useLang()
  const purchase = useFlagshipPurchase(offer)
  if (compact) return <RaayonitPromoStrip offer={offer} count={count} />
  const { cards, selectedPool, ownedPools } = purchase
  return (
    <section aria-labelledby="gift-cards-title" className="mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-blue-100/80 bg-gradient-to-br from-blue-50/70 to-indigo-50/30 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-6 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-10 lg:p-8">
      <Link href={RAAYONIT_HUB} aria-label={t('products_card_name')} className="block rounded-[20px] transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [@media(hover:hover)]:hover:-translate-y-1 lg:order-none">
        <ClubCard />
      </Link>
      <div className="mt-5 min-w-0 lg:mt-0">
        <h2 id="gift-cards-title" className="text-[22px] font-extrabold tracking-tight text-ink sm:text-2xl">{t('products_title')}</h2>
        <p className="mt-1 text-sm font-semibold text-brand">{t('gift_valid_chains').replace('{count}+', isolateLtr(`${roundedCount(count)}+`))}</p>
        <div role="radiogroup" aria-label={t('products_card_name')} className="mt-4 grid grid-cols-2 gap-3">
          {cards.map((c) => {
            const worth = t('products_worth').replace('{value}', isolateLtr(`₪${c.value}`))
            const on = c.pool === selectedPool
            const owned = ownedPools.includes(c.pool)
            return (
              <button key={c.pool} type="button" role="radio" aria-checked={on} disabled={owned} onClick={() => purchase.select(c.pool)} aria-label={`${isolateLtr(`₪${c.price}`)}, ${worth}`} className={`flex min-h-[84px] flex-col items-center justify-center gap-0.5 rounded-2xl border bg-white p-3 text-center transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${on ? 'border-brand ring-2 ring-brand/30' : 'border-slate-200/80'} ${owned ? 'cursor-not-allowed opacity-45' : '[@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:border-slate-300'}`}>
                <bdi dir="ltr" className="text-2xl font-extrabold tracking-tight tabular-nums text-ink">{`₪${c.price}`}</bdi>
                <span className="text-[12.5px] text-slate-500">{worth}</span>
              </button>
            )
          })}
        </div>
        <FlagshipCta purchase={purchase} className="mt-4 flex min-h-12 w-full items-center justify-center gap-1 rounded-2xl bg-brand px-4 text-[15px] font-bold text-white transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [@media(hover:hover)]:hover:-translate-y-0.5" />
        <Link href={RAAYONIT_HUB} className="mt-1 flex min-h-11 w-full items-center justify-center gap-1 text-sm font-bold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [@media(hover:hover)]:hover:underline">
          {t('products_details_link').replace('{count}+', isolateLtr(`${roundedCount(count)}+`))}
          <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
        </Link>
      </div>
    </section>
  )
}
