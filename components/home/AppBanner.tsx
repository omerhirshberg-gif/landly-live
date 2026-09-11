'use client'

import { useLang } from '@/lib/i18n/useLang'

export default function AppBanner() {
  const { t } = useLang()

  return (
    <div className="bg-brand text-white py-4 px-5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-mobile-screen-button text-xl text-blue-200 flex-shrink-0"></i>
          <p className="font-semibold text-sm md:text-base text-center md:text-left">
            <span>{t('app_banner_text')}</span>
          </p>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <div aria-disabled="true" className="relative flex items-center gap-2 bg-white/10 border border-white/25 rounded-xl px-4 py-2 opacity-50 cursor-not-allowed">
            <i className="fa-brands fa-apple text-xl"></i>
            <div className="leading-tight text-left"><div className="text-[10px] text-blue-200">Download on the</div><div className="text-sm font-bold">App Store</div></div>
            <span className="absolute -top-2 -end-2 bg-white text-brand text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">{t('deals_card_soon_badge')}</span>
          </div>
          <div aria-disabled="true" className="relative flex items-center gap-2 bg-white/10 border border-white/25 rounded-xl px-4 py-2 opacity-50 cursor-not-allowed">
            <i className="fa-brands fa-google-play text-xl"></i>
            <div className="leading-tight text-left"><div className="text-[10px] text-blue-200">Get it on</div><div className="text-sm font-bold">Google Play</div></div>
            <span className="absolute -top-2 -end-2 bg-white text-brand text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">{t('deals_card_soon_badge')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
