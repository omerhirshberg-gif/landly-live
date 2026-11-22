'use client'

import { useMemo, useState } from 'react'
import { MemberColumn } from '@/components/layout/MemberPageShell'
import HowToRedeem from '@/components/offers/HowToRedeem'
import type { OfferDocument } from '@/lib/firebase/offers'
import { useLang } from '@/lib/i18n/useLang'
import { chainsByCategory } from '@/lib/offers/discoverTab'
import { RAAYONIT_ROW_COUNT } from '@/lib/offers/raayonitRows'
import RaayonitCategoryDialog from './RaayonitCategoryDialog'
import RaayonitCategoryRail from './RaayonitCategoryRail'

// What sits under the value choice on the details page (native: landly-mobile/src/components/RaayonitCardDetails.tsx): what the voucher is and
// its conditions, how to redeem it, and the businesses that accept it as one row with "Show all" and a link to the whole hub.
export default function RaayonitCardDetails({ offer, chains }: { offer: OfferDocument | null; chains: OfferDocument[] }) {
  const { t, lang } = useLang()
  const [all, setAll] = useState(false)
  const list = useMemo(() => chainsByCategory(chains, lang).flatMap((g) => g.offers), [chains, lang])
  const heading = 'text-lg font-extrabold tracking-tight text-ink sm:text-xl'
  return (
    <div className="mt-8 space-y-8 pb-28 sm:pb-12">
      <MemberColumn wide>
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-2">
          <section aria-labelledby="raayonit-about">
            <h2 id="raayonit-about" className={heading}>{t('raayonit_about_title')}</h2>
            <div className="mt-3 space-y-2.5 rounded-2xl border border-slate-200/80 bg-white p-4 text-[14px] leading-6 text-body shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
              <p>{t('raayonit_flagship_desc')}</p>
              <p>{t('raayonit_hotel_notice')}</p>
            </div>
          </section>
          <section aria-labelledby="raayonit-redeem">
            <h2 id="raayonit-redeem" className="sr-only">{t('raayonit_rules_title')}</h2>
            <HowToRedeem method={offer?.redemptionMethod ?? 'in_store'} instructions="" codeOnly variant="card" />
          </section>
        </div>
      </MemberColumn>
      {list.length > 0 && (
        <div>
          <RaayonitCategoryRail id="raayonit-accepting" title={t('raayonit_accepting_title')} offers={list.slice(0, RAAYONIT_ROW_COUNT)} hasMore={list.length > RAAYONIT_ROW_COUNT} onShowAll={() => setAll(true)} />
        </div>
      )}
      {all && <RaayonitCategoryDialog title={t('raayonit_accepting_title')} offers={list} onClose={() => setAll(false)} />}
    </div>
  )
}
