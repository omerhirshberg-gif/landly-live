'use client'

import { useLang } from '@/lib/i18n/useLang'

export default function DealsSection({ onOpenRaffleTerms }: { onOpenRaffleTerms: () => void }) {
  const { t } = useLang()

  return (
    <section id="deals" className="py-14 sm:py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="text-xs font-bold tracking-widest text-brand uppercase mb-3">{t('deals_label')}</div>
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3" style={{ letterSpacing: '-1px' }}>{t('deals_title')}</h2>
        <p className="text-slate-500 mb-8 sm:mb-10 max-w-xl text-[14px] sm:text-[15px] leading-relaxed">{t('deals_sub')}</p>

        <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl mb-8 sm:mb-10">
          <i className="fa-solid fa-tags"></i>
          <div className="font-bold text-slate-700 text-base mb-1">{t('deals_empty_title')}</div>
          <p className="text-sm text-slate-500 max-w-xs">{t('deals_empty_sub')}</p>
        </div>

        {/* Card-grid preview of the eventual deals layout — every card is an
            identical neutral placeholder, no invented business names/photos/prices */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-10 sm:mb-12">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="relative aspect-[4/3] bg-slate-50 flex items-center justify-center">
                <i className="fa-regular fa-image text-3xl text-slate-300"></i>
                <span className="absolute top-2.5 end-2.5 bg-white/95 text-[10px] font-bold text-slate-400 px-2.5 py-1 rounded-full shadow-sm">
                  {t('deals_card_soon_badge')}
                </span>
              </div>
              <div className="p-3 sm:p-3.5 space-y-2">
                <div className="h-2.5 w-3/4 bg-slate-100 rounded-full"></div>
                <div className="h-2 w-1/2 bg-slate-100 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>

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
              <button onClick={onOpenRaffleTerms} className="tap-target justify-center bg-white text-brand font-bold text-sm px-5 py-3 rounded-full hover:bg-brandLight transition shadow whitespace-nowrap">{t('raffle_card_details')}</button>
            </div>
          </div>
        </div>

        <div className="join-cta-banner mb-4">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-star text-brand text-xl flex-shrink-0"></i>
            <div>
              <p className="font-bold text-slate-900 text-sm sm:text-base">{t('join_banner_headline')}</p>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">{t('join_banner_sub')}</p>
            </div>
          </div>
          <a href="#pricing" className="tap-target bg-brand text-white font-bold text-sm px-6 py-3 rounded-full hover:bg-brandDark transition shadow-md flex-shrink-0">{t('join_banner_cta')}</a>
        </div>
      </div>
    </section>
  )
}
