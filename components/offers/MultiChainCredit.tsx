'use client'

import Image from 'next/image'
import { Ticket } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { useChainNetwork } from '@/lib/offers/useChainBrands'
import { withChainCount } from '@/lib/offers/multiChainNote'
import { RAAYONIT_LOGO_PATH } from '@/lib/payments/issuer'
import { useRaayonitDisplay } from '@/lib/flags/raayonitDisplayStore'
import { Fold } from './HowToRedeem'
import BrandStrip from './BrandStrip'

// A Raayonit voucher bought through one brand is still a Multi-Chain Super Tav. Three touchpoints on the website
// (Expo: landly-mobile/src/components/MultiChainCredit.tsx): the bonus line before purchase, the credit card under the
// code, and the "where else can I redeem?" fold with search over every participating chain.

/** The live size of the Raayonit network (distinct brands on sale), from the offers already loaded. */
export function useNetworkSize() {
  const brands = useChainNetwork()
  return { brands, count: brands.length }
}

/** Before purchase, under the denomination selector: the bonus line with a link to the chains fold (anchor `#perk-chains`). */
export function MultiChainBonus({ className = '', onSeeChains }: { className?: string; onSeeChains: () => void }) {
  const { t } = useLang()
  const { count } = useNetworkSize()
  return (
    <p className={`flex items-start gap-2 text-[13px] leading-[19px] text-body ${className}`}>
      <Ticket aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={1.75} />
      <span>
        {withChainCount(t('offer_multi_chain_bonus'), count)}{' '}
        <button type="button" onClick={onSeeChains} className="font-bold text-brand underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          {t('offer_chains_link')}
        </button>
      </span>
    </p>
  )
}

/** A voucher's credit card, under its code: the Raayonit logo and "issued as a Multi-Chain Super Tav, valid here and at N more chains". */
export function MultiChainCreditBox({ className = '' }: { className?: string }) {
  const { t } = useLang()
  const { count } = useNetworkSize()
  const display = useRaayonitDisplay()
  return (
    <div className={`flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 text-start ${className}`}>
      {display && (
        <span aria-hidden="true" className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-white">
          <Image src={RAAYONIT_LOGO_PATH} alt="" width={21} height={38} className="h-[38px] w-auto" unoptimized />
        </span>
      )}
      <p className="min-w-0 text-[13px] font-semibold leading-[19px] text-slate-800">{withChainCount(t('voucher_multi_chain_credit'), count)}</p>
    </div>
  )
}

/** "Where else can I redeem this voucher? (240+ chains)": folds open to a search over every participating chain. */
export function ChainsFold({ defaultOpen = false, id }: { defaultOpen?: boolean; id?: string }) {
  const { t } = useLang()
  const { brands, count } = useNetworkSize()
  const display = useRaayonitDisplay()
  if (!display || brands.length === 0) return null
  const title = withChainCount(t('voucher_chains_where_else'), count).replace(/\s*\(\s*\)/, '')
  return (
    <div id={id} className="scroll-mt-28">
      <Fold title={title} defaultOpen={defaultOpen}><BrandStrip entries={brands} /></Fold>
    </div>
  )
}
