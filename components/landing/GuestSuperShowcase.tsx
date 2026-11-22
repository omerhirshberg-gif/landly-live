'use client'

import Image from 'next/image'
import { useMemo } from 'react'
import { QrCode, Store, Ticket } from 'lucide-react'
import GuestChainRail from '@/components/landing/GuestChainRail'
import BrandLogoWall from '@/components/home/BrandLogoWall'
import MultiChainShowcase from '@/components/discover/MultiChainShowcase'
import { LANDING_COLUMN } from '@/components/landing/landingColumn'
import { selectSuperVouchers } from '@/lib/home/categoryRails'
import { isChain } from '@/lib/offers/discoverTab'
import { useRaayonitDisplay } from '@/lib/flags/raayonitDisplayStore'
import { useLang } from '@/lib/i18n/useLang'
import { RAAYONIT_LOGO_PATH } from '@/lib/payments/issuer'
import { useOffers } from '@/lib/offers/useOffers'

const FEATURES = [
  { icon: Ticket, key: 'guest_raayonit_f1' },
  { icon: QrCode, key: 'guest_raayonit_f2' },
  { icon: Store, key: 'guest_raayonit_f3' },
] as const

// The flagship multi-chain vouchers on the guest landing, above the live deals: the same showcase /categories opens with, the
// three things the card does, and the real chains that accept it. It needs the full offer (its voucher values), which the
// server-cut landing deals don't carry, so it reads the shared live list and renders nothing until a real multi-chain offer
// is on sale. A guest opens any card freely; sign-in comes at the purchase bar.
export default function GuestSuperShowcase() {
  const { t } = useLang()
  // The logo, like the name, shows only while Raayonit's display approval is on (the dictionary already goes neutral without it).
  const showLogo = useRaayonitDisplay()
  const { offers } = useOffers()
  const superOffer = useMemo(() => (offers ? selectSuperVouchers(offers)[0] : undefined), [offers])
  const chains = useMemo(() => (offers ?? []).filter(isChain), [offers])
  if (!offers || !superOffer) return null
  return (
    <section className={`${LANDING_COLUMN} pt-8 sm:pt-10 lg:pt-12`}>
      <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-blue-50/40 to-indigo-50/20 px-4 py-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:px-8 sm:py-10">
        <MultiChainShowcase offer={superOffer} uniform />
        <ul className="-mx-4 mb-8 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-auto sm:max-w-4xl sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {FEATURES.map(({ icon: Icon, key }) => (
            <li key={key} className="flex shrink-0 basis-[78%] snap-start items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-3.5 backdrop-blur-md sm:basis-auto">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0038B8]/10">
                <Icon className="h-5 w-5 text-[#0038B8]" strokeWidth={1.75} />
              </span>
              <span className="text-sm font-semibold leading-snug text-ink">{t(key)}</span>
            </li>
          ))}
        </ul>
        <BrandLogoWall offers={offers} rail />
        <GuestChainRail chains={chains} />
        <div className="mx-auto mt-6 flex w-fit max-w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-2.5 pe-4 backdrop-blur-md">
          {showLogo && (
            <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <Image src={RAAYONIT_LOGO_PATH} alt="" width={26} height={46} className="h-[42px] w-auto" unoptimized />
            </span>
          )}
          <p className="min-w-0 text-meta font-semibold leading-snug text-slate-600">{t('products_issued_line')}</p>
        </div>
      </div>
    </section>
  )
}
