'use client'

import { useState } from 'react'
import { useLang } from '@/lib/i18n/useLang'
import { dealRows, categoryFilters } from '@/lib/data/deals'
import DealRow from './DealRow'

export default function DealsSection({ onOpenRaffleTerms }: { onOpenRaffleTerms: () => void }) {
  const { t } = useLang()
  const [activeCat, setActiveCat] = useState('all')

  return (
    <section id="deals" className="py-14 sm:py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="text-xs font-bold tracking-widest text-brand uppercase mb-3">{t('deals_label')}</div>
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3" style={{ letterSpacing: '-1px' }}>{t('deals_title')}</h2>
        <p className="text-slate-500 mb-8 sm:mb-10 max-w-xl text-[14px] sm:text-[15px] leading-relaxed">{t('deals_sub')}</p>

        <div className="flex gap-2.5 flex-wrap mb-8 sm:mb-10">
          {categoryFilters.map((f) => (
            <button
              key={f.cat}
              onClick={() => setActiveCat(f.cat)}
              className={
                activeCat === f.cat
                  ? 'cat-btn tap-target bg-brand text-white px-4 py-2.5 rounded-full text-[13px] font-bold shadow'
                  : 'cat-btn tap-target bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-full text-[13px] font-semibold hover:border-brand hover:text-brand transition'
              }
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        {dealRows.map((row, i) => {
          const visible = activeCat === 'all' || activeCat === row.cat
          const isLast = i === dealRows.length - 1
          return (
            <div key={row.cat}>
              <DealRow row={row} visible={visible} spacingClassName={isLast ? 'mb-4' : undefined} />

              {row.cat === 'bestsellers' && (
                <div className="raffle-glow-card mb-10 sm:mb-12">
                  <div className="relative z-[1] flex flex-col sm:flex-row items-center sm:items-center gap-5 justify-between">
                    <div className="flex items-center gap-4">
                      <div className="raffle-glow-icon"><i className="fa-solid fa-champagne-glasses"></i></div>
                      <div>
                        <p className="text-white font-black text-base sm:text-lg leading-snug">{t('raffle_card_headline')}</p>
                        <p className="text-white/75 text-xs sm:text-sm mt-1">{t('raffle_card_sub')}</p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2.5 flex-shrink-0 w-full sm:w-auto">
                      <a href="#pricing" className="tap-target justify-center bg-white text-brand font-bold text-sm px-5 py-3 rounded-full hover:bg-brandLight transition shadow whitespace-nowrap">{t('raffle_card_cta')}</a>
                      <button onClick={onOpenRaffleTerms} className="tap-target justify-center border-2 border-white/60 text-white font-bold text-sm px-5 py-3 rounded-full hover:bg-white/10 transition whitespace-nowrap">{t('raffle_card_details')}</button>
                    </div>
                  </div>
                </div>
              )}

              {row.cat === 'beauty' && (
                <div className="join-cta-banner mb-10 sm:mb-12">
                  <div className="flex items-center gap-3">
                    <i className="fa-solid fa-star text-brand text-xl flex-shrink-0"></i>
                    <div>
                      <p className="font-bold text-slate-900 text-sm sm:text-base">{t('join_banner_headline')}</p>
                      <p className="text-slate-500 text-xs sm:text-sm mt-0.5">{t('join_banner_sub')}</p>
                    </div>
                  </div>
                  <a href="#pricing" className="tap-target bg-brand text-white font-bold text-sm px-6 py-3 rounded-full hover:bg-brandDark transition shadow-md flex-shrink-0">{t('join_banner_cta')}</a>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
