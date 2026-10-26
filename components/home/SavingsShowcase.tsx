'use client'

import Link from 'next/link'
import { ArrowRight, PiggyBank } from 'lucide-react'
import Reveal from '@/components/ui/Reveal'
import CategoryIcon from '@/components/ui/CategoryIcon'
import { CATEGORY_TILES } from '@/lib/categories'
import { formatPrice, formatSavings } from '@/lib/format'
import { offerSavings, type ShowcaseOffer } from '@/lib/home/showcase'
import { discountPercent } from '@/lib/perks/perksFilter'
import { useLang } from '@/lib/i18n/useLang'
import { localizeText } from '@/lib/i18n/contentTranslation'
import { localizedBusinessName } from '@/lib/business/businessText'

// "What members actually save", in place of the perk examples on the guest
// home: the live offers with the biggest real savings (lib/home/showcase.ts
// picks three to six, one per business; HomePage leaves the section out when
// there are fewer). Every figure is the offer's own original price minus its
// club price. Shekel amounts follow the reader's language (formatSavings) and
// sit in <bdi>, so "₪150" stays whole inside Hebrew text. Cards rise in one
// after another; with a real pointer a hovered card lifts 6px and grows 1.5%
// under a soft brand shadow. Each opens its offer.
export default function SavingsShowcase({ offers }: { offers: readonly ShowcaseOffer[] }) {
  const { t, lang } = useLang()
  const total = offers.reduce((sum, o) => sum + offerSavings(o), 0)
  const [totalBefore, totalAfter] = t('landing_savings_total').replace('{count}', String(offers.length)).split('{amount}')

  return (
    <section aria-labelledby="home-savings-title" className="py-12 sm:py-14 lg:py-16">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6 sm:mb-8">
          <div className="max-w-2xl">
            <div className="text-xs font-bold tracking-widest text-brand uppercase mb-3">{t('landing_savings_label')}</div>
            <h2 id="home-savings-title" className="text-xl sm:text-2xl font-bold tracking-tight text-ink mb-2">
              {t('landing_savings_title')}
            </h2>
            <p className="text-body text-copy sm:text-base leading-relaxed">
              {totalBefore}
              <bdi className="font-extrabold text-success">{formatSavings(total, lang)}</bdi>
              {totalAfter}
            </p>
          </div>
          <Link
            href="/categories?sort=savings"
            className="tap-target flex-shrink-0 inline-flex items-center gap-1.5 text-sm font-bold text-brand hover:underline whitespace-nowrap"
          >
            <span>{t('home_examples_all')}</span>
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 rtl:-scale-x-100" strokeWidth={2} />
          </Link>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {offers.map((offer, i) => (
            <li key={offer.id} className="flex">
              <Reveal delay={Math.min(i, 5) * 70} className="flex w-full">
                <SavingsCard offer={offer} />
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function SavingsCard({ offer }: { offer: ShowcaseOffer }) {
  const { t, lang } = useLang()
  const title = localizeText(offer.title, offer.translations, lang, 'title')
  const name = localizedBusinessName(offer, lang)
  const tile = CATEGORY_TILES.find((c) => c.category === offer.category)
  const percent = discountPercent(offer.originalPrice, offer.offerPrice)
  const [savedBefore, savedAfter] = t('landing_savings_badge').split('{amount}')

  return (
    <Link
      href={`/offers/${encodeURIComponent(offer.id)}`}
      className="group flex w-full flex-col rounded-2xl border border-line bg-white/95 backdrop-blur-sm p-5 shadow-card transition-[box-shadow,transform,border-color] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none [@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:scale-[1.015] [@media(hover:hover)]:hover:border-brand/25 [@media(hover:hover)]:hover:shadow-[0_1px_2px_rgba(15,23,42,.05),0_20px_35px_-10px_rgba(0,56,184,0.08)] motion-reduce:[@media(hover:hover)]:hover:translate-y-0 motion-reduce:[@media(hover:hover)]:hover:scale-100"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        {tile ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-brandTint px-2.5 py-1 text-micro font-semibold text-ink">
            <CategoryIcon category={tile.category} className="h-3 w-3 flex-shrink-0 text-brand" strokeWidth={2} />
            <span className="truncate">{t(tile.labelKey)}</span>
          </span>
        ) : (
          <span />
        )}
        {percent > 0 && (
          <span className="flex-shrink-0 rounded-full bg-success px-2.5 py-1 text-micro font-extrabold uppercase leading-none tracking-wide text-white">
            {t('offer_percent_off').replace('{n}', String(percent))}
          </span>
        )}
      </div>

      <div className="truncate text-title font-bold leading-snug text-ink" lang={name.lang ?? undefined} dir="auto">{name.text}</div>
      <p className="mt-1 line-clamp-2 min-h-[2.5em] text-sm leading-snug text-body" lang={title.lang ?? undefined} dir="auto">{title.text}</p>

      <div className="mt-auto pt-5 flex flex-wrap items-end justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 px-3 py-2 text-copy font-extrabold text-success ring-1 ring-inset ring-success/10">
          <PiggyBank aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          <span>
            {savedBefore}
            <bdi>{formatSavings(offerSavings(offer), lang)}</bdi>
            {savedAfter}
          </span>
        </span>
        <span className="inline-flex items-baseline gap-2" dir="ltr">
          <span className="text-base font-extrabold tracking-tight text-brand">{formatPrice(offer.offerPrice)}</span>
          <span className="text-xs text-muted line-through decoration-muted/70">{formatPrice(offer.originalPrice)}</span>
        </span>
      </div>
    </Link>
  )
}
