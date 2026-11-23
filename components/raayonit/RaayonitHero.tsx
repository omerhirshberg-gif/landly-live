'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, Info } from 'lucide-react'
import type { OfferDocument } from '@/lib/firebase/offers'
import { isolateLtr, type ShowcaseCard } from '@/lib/home/superShowcase'
import { flagshipLimitNotice } from '@/lib/offers/flagshipLimit'
import { useLang } from '@/lib/i18n/useLang'
import { RAAYONIT_LOGO_PATH } from '@/lib/payments/issuer'
import { useRaayonitDisplay } from '@/lib/flags/raayonitDisplayStore'
import ComingSoonNotice from './ComingSoonNotice'
import FlagshipCta from './FlagshipCta'
import { useFlagshipPurchase } from './useFlagshipPurchase'
import { ARCH, ARROW, EMBLEM_VIEWBOX, STAR } from '@/lib/brand/emblemPaths'

// The flagship product of "Our Products" (native: landly-mobile/src/components/RaayonitHero.tsx): a royal-blue club card
// (GoLandly, Raayonit Card, "Issued by Raayonit Ltd."), three equal-height denomination tiles read from the live offer (89 / 132 / 174, the 200 value pre-selected as "Best value", when
// none are configured), a one-line validity note, the primary "Details & Purchase" link and one collapsed row for the full rules.
export default function RaayonitHero({ offer, buy = false, step = 'hub' }: { offer: OfferDocument | null; buy?: boolean; /** 'hub': the action opens the details page. 'details': the action continues to checkout and the rules fold is left out (the page shows them). */ step?: 'hub' | 'details' }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const purchase = useFlagshipPurchase(offer)
  const { cards, selectedPool, ownedPools } = purchase
  const limit = buy && step === 'details' ? flagshipLimitNotice(cards, ownedPools) : null
  // On the hub (`buy`) a tile selects its value and the action goes straight to checkout; elsewhere the whole card opens the hub.
  return (
    <section aria-label={t('products_card_name')} className="w-full min-w-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <ClubCard />
      <div className="mt-5 min-w-0 lg:mt-0 lg:flex lg:flex-col lg:justify-center">
        {step === 'details' && <h2 id="raayonit-choose" className="mb-3 text-lg font-extrabold tracking-tight text-ink sm:text-xl">{t('raayonit_choose_value')}</h2>}
        <div role={buy && step === 'details' ? 'radiogroup' : undefined} aria-labelledby={buy && step === 'details' ? 'raayonit-choose' : undefined} className="grid grid-cols-3 items-stretch gap-2 sm:gap-3">
          {cards.map((c) => <ValueCard key={c.pool} card={c} href={buy ? null : '/raayonit'} selected={buy && step === 'details' && c.pool === selectedPool} owned={buy && step === 'details' && ownedPools.includes(c.pool)} onSelect={buy && step === 'details' ? () => purchase.select(c.pool) : undefined} />)}
        </div>
        {limit && (
          <div role="status" className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-white p-3.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-200/70 bg-amber-50 text-amber-700">
              <Info className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            <p className="min-w-0 flex-1 self-center text-[13.5px] font-semibold leading-5 text-amber-950">
              {t(limit.kind === 'all' ? 'raayonit_limit_all' : 'raayonit_limit_some').replace('{values}', limit.values)}
              {limit.kind === 'all' && <> <Link href="/member" className="font-bold text-brand underline-offset-2 hover:underline">{t('success_to_my_pass')}</Link></>}
            </p>
          </div>
        )}
        {purchase.block === 'comingSoon' && <ComingSoonNotice className="mt-4" />}
        {buy ? (
          <FlagshipCta to={step === 'details' ? 'checkout' : 'details'} purchase={purchase} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-brand px-4 text-[15px] font-bold text-white transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" />
        ) : (
          <Link href="/raayonit" className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-brand px-4 text-[15px] font-bold text-white transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            {t('products_cta')}
          </Link>
        )}
        {step === 'hub' && <button type="button" aria-expanded={open} aria-controls="raayonit-rules" onClick={() => setOpen(!open)} className="mt-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl bg-brandTint px-3.5 text-start text-[13.5px] font-bold text-brand">
          <span>{t('raayonit_rules_title')}</span>
          <ChevronDown aria-hidden="true" className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
        </button>}
        {step === 'hub' && open && (
          <div id="raayonit-rules" className="space-y-2.5 px-1 pt-3 text-[13px] leading-5 text-body">
            <p>{t('raayonit_flagship_desc')}</p>
            <p>{t('raayonit_hotel_notice')}</p>
          </div>
        )}
      </div>
    </section>
  )
}

// The club card graphic, a co-branded gift card laid out left to right like a physical one: the GoLandly emblem and wordmark with the
// Raayonit logo in a white badge on top, the product name in the middle, the issuer line under a hairline at the bottom.
function WhiteEmblem() {
  return (
    <svg viewBox={`0 0 ${EMBLEM_VIEWBOX.width} ${EMBLEM_VIEWBOX.height}`} className="h-8 w-auto sm:h-10" aria-hidden="true" focusable="false">
      {[STAR, ARCH, ARROW].map((part, i) => (
        <g key={i}>
          <path d={part.light} fill="#fff" fillRule="evenodd" />
          <path d={part.dark} fill="rgba(255,255,255,0.72)" fillRule="evenodd" />
        </g>
      ))}
    </svg>
  )
}

export function ClubCard() {
  const { t } = useLang()
  const display = useRaayonitDisplay()
  return (
    <div dir="ltr" role="img" aria-label={`GoLandly, ${t('products_card_name')}, ${t('products_issued_line')}`}
      className="relative flex h-full min-h-[250px] w-full min-w-0 max-w-full flex-col justify-between overflow-hidden rounded-[22px] bg-gradient-to-br from-blue-700 to-[#0B2A8F] px-5 py-5 text-white shadow-[0_8px_30px_rgb(29,78,216,0.25)] sm:p-7 lg:min-h-[300px]">
      <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-16 h-[340px] w-[120px] rotate-[24deg] bg-white/[0.07]" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[84px] h-px bg-white/20 sm:top-[100px]" />
      <div aria-hidden="true" className="relative flex items-center justify-between">
        <span className="flex min-w-0 shrink items-center gap-2">
          <WhiteEmblem />
          <span className="text-xl font-black tracking-tight sm:text-2xl">GoLandly</span>
        </span>
        {display && (
          <span className="flex h-12 items-center rounded-xl bg-white px-2.5 shadow-sm sm:h-14 sm:px-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={RAAYONIT_LOGO_PATH} alt="" width={20} height={34} className="h-10 w-auto sm:h-12" />
          </span>
        )}
      </div>
      <div aria-hidden="true" className="relative">
        <p className="truncate text-[32px] font-extrabold tracking-tight sm:text-4xl">{t('products_card_name')}</p>
        <p className="mt-1 line-clamp-2 min-w-0 break-words text-sm text-white/80 sm:text-[15px]">{t('products_card_tagline')}</p>
      </div>
      <div aria-hidden="true" className="relative">
        <div className="mb-2 h-px bg-white/35" />
        <p className="line-clamp-2 min-w-0 break-words text-left text-xs leading-4 text-white/85 sm:text-[13px]">{t('products_issued_line')}</p>
      </div>
    </div>
  )
}

function ValueCard({ card, href, selected, owned, onSelect }: { card: ShowcaseCard; href: string | null; selected: boolean; owned: boolean; onSelect?: () => void }) {
  const { t } = useLang()
  const worth = t('products_worth').replace('{value}', isolateLtr(`₪${card.value}`))
  // A tile is a price card: the discount on a green ribbon across the start corner, the price, what the card is worth and what you save. On the hub they only
  // show the ladder (the best value is emphasised); on the details page they are the value choice.
  const emphasis = selected || (!onSelect && !href && card.best)
  const cls = `relative flex min-h-[148px] min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border px-1.5 pb-4 pt-9 text-center shadow-[0_6px_20px_rgba(15,23,42,0.06)] transition-all duration-300 sm:px-3 ${emphasis ? 'border-brand bg-gradient-to-b from-brandTint to-white ring-2 ring-brand/25' : 'border-slate-200/80 bg-white'}`
  const body = (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute -start-9 top-3.5 w-[112px] -rotate-45 bg-gradient-to-r from-emerald-500 to-green-600 py-[3px] text-center text-[11px] font-extrabold leading-4 text-white shadow-sm rtl:rotate-45">
        <bdi dir="ltr" className="tabular-nums">{`-${card.discountPercent}%`}</bdi>
      </span>
      <bdi dir="ltr" className="text-[28px] font-extrabold leading-none tracking-tight tabular-nums text-ink sm:text-[32px]">{`₪${card.price}`}</bdi>
      <span className="text-xs font-medium text-slate-500">{worth}</span>
      {card.save > 0 && <span className="mt-0.5 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">{t('super_card_save').replace('{amount}', isolateLtr(`₪${card.save}`))}</span>}
      {selected && <span aria-hidden="true" className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white shadow-sm"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>}
      {card.best && <span className="absolute inset-x-0 bottom-0 whitespace-nowrap bg-brand py-0.5 text-[9px] font-bold leading-4 text-white sm:text-[10px]">{t('raayonit_best_value').replace('{percent}', isolateLtr(`${card.discountPercent}%`))}</span>}
    </>
  )
  const label = `${isolateLtr(`₪${card.price}`)}, ${worth}`
  if (onSelect) {
    return (
      <button type="button" role="radio" aria-checked={selected} aria-label={label} disabled={owned} onClick={onSelect} className={`${cls} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${owned ? 'cursor-not-allowed opacity-45' : 'hover:-translate-y-0.5'}`}>{body}</button>
    )
  }
  return href ? (
    <Link href={href} aria-label={label} className={`${cls} hover:-translate-y-0.5`}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
