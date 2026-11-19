'use client'

import Link from 'next/link'
import { ArrowUpLeft, ArrowUpRight } from 'lucide-react'
import type { OfferDocument } from '@/lib/firebase/offers'
import { isolateLtr, showcaseCards, type ShowcaseCard } from '@/lib/home/superShowcase'
import { useLang } from '@/lib/i18n/useLang'

// The flagship "Multi-Chain Super Vouchers" showcase at the top of /categories (Expo: landly-mobile/src/components/MultiChainShowcase.tsx):
// a centred header, then one large card per voucher value side by side. The top value is the midnight-navy "Best Value" card. Each card
// opens the multi-chain offer with its value already picked (?denomination=). Prices and percentages sit in <bdi dir="ltr"> so Hebrew
// keeps them in reading order.
export default function MultiChainShowcase({ offer }: { offer: OfferDocument }) {
  const { t } = useLang()
  const cards = showcaseCards(offer)
  if (cards.length === 0) return null

  return (
    <section aria-labelledby="super-showcase-title" className="mx-auto mb-10 w-full max-w-4xl">
      <div className="mx-auto mb-6 max-w-2xl text-center">
        <h2 id="super-showcase-title" className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{t('super_showcase_title')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-body sm:text-base">{t('super_showcase_sub')}</p>
      </div>
      <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2">
        {cards.map((card) => <VoucherCard key={card.pool} card={card} />)}
      </div>
    </section>
  )
}

function VoucherCard({ card }: { card: ShowcaseCard }) {
  const { t } = useLang()
  const dark = card.best
  const value = isolateLtr(`₪${card.value}`)
  const cta = t('super_card_cta').replace('{value}', value)
  const eyebrow = t('super_card_title')
  return (
    <Link
      href={card.href}
      aria-label={`${t('super_card_title')} ${value}: ${isolateLtr(`₪${card.price}`)}`}
      className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0038B8]/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-7 ${
        dark
          ? 'border border-transparent bg-gradient-to-br from-[#0B1B3D] via-[#102654] to-[#0B1B3D] text-white ring-2 ring-[#0038B8]/30 shadow-[0_16px_40px_-12px_rgba(11,27,61,0.35)]'
          : 'border border-[#E2E8F0] bg-white text-ink shadow-sm hover:shadow-[0_12px_32px_-12px_rgba(11,27,61,0.18)]'
      }`}
    >
      {/* The discount hangs across the top trailing corner as a diagonal ribbon (the card clips it): 45deg at the right in English, -45deg at the left in Hebrew. */}
      <span aria-hidden="true" className="pointer-events-none absolute -end-[34px] top-[22px] z-10 w-[132px] rotate-45 bg-[#059669] py-1 text-center text-xs font-bold text-white shadow-[0_2px_6px_rgba(0,0,0,0.25)] rtl:-rotate-45">
        <bdi dir="ltr" className="tabular-nums">-{card.discountPercent}%</bdi>
      </span>
      <span className="sr-only">-{card.discountPercent}%</span>
      <div className={`relative z-10 truncate ${dark ? 'pe-20' : ''} text-xs tracking-wide ${dark ? 'font-bold text-amber-300' : 'font-semibold text-slate-500'} uppercase`}>{eyebrow}</div>
      <div className={`relative z-10 mt-1 truncate ${dark ? 'pe-20' : ''} text-xl font-bold ${dark ? 'text-white' : 'text-[#0B1B3D]'}`}>{t('super_card_value_line').replace('{value}', '\u2066₪' + card.value + '\u2069')}</div>

      <div className="relative z-10 mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <bdi dir="ltr" className={`text-3xl font-extrabold tracking-tight tabular-nums ${dark ? 'text-white' : 'text-[#0B1B3D]'}`}>₪{card.price}</bdi>
        <bdi dir="ltr" className={`text-sm tabular-nums line-through ${dark ? 'text-white/50' : 'text-slate-400'}`}>₪{card.value}</bdi>
      </div>

      <span className={`relative z-10 mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold transition-colors ${dark ? 'bg-white text-[#0B1B3D] group-hover:bg-blue-50' : 'bg-brand text-white group-hover:bg-brandHover'}`}>
        {cta}
        <ArrowUpRight aria-hidden="true" className="h-4 w-4 rtl:hidden" strokeWidth={2} />
        <ArrowUpLeft aria-hidden="true" className="hidden h-4 w-4 rtl:block" strokeWidth={2} />
      </span>
    </Link>
  )
}
