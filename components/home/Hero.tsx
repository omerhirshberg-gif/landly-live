'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'

export default function Hero({ onOpenRaffleTerms }: { onOpenRaffleTerms: () => void }) {
  const { t } = useLang()

  return (
    <section id="hero" className="relative bg-white pt-24 pb-14 sm:pt-28 sm:pb-20">
      {/* Compact floating raffle pill */}
      <button onClick={onOpenRaffleTerms} className="raffle-float">
        <span className="raffle-icon-wrap"><i className="fa-solid fa-gift"></i></span>
        <span>{t('raffle_pill_text')}</span>
      </button>

      <div className="max-w-3xl mx-auto px-5 sm:px-6 text-center">
        <h1 className="font-black text-slate-900 leading-[1.15] mb-5" style={{ fontSize: 'clamp(32px,6vw,52px)', letterSpacing: '-1.5px' }}>
          <span>{t('hero_line1')}</span><br />
          <span className="text-brand">{t('hero_line2')}</span>
        </h1>

        <p className="text-slate-500 text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-8">
          {t('hero_sub')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8 sm:mb-10">
          <a href="#deals" className="btn-primary">
            <i className="fa-solid fa-tags"></i> <span>{t('hero_cta1')}</span>
          </a>
          <Link
            href="/signup"
            className="tap-target inline-flex items-center justify-center gap-2 bg-white border-2 border-slate-200 text-slate-700 font-extrabold text-[15px] px-7 py-3.5 rounded-full hover:border-slate-300 hover:bg-slate-50 transition min-h-[50px]"
          >
            <i className="fa-solid fa-user-plus"></i> <span>{t('hero_cta2')}</span>
          </Link>
        </div>

        <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap text-slate-500 text-xs sm:text-sm font-semibold">
          <span className="flex items-center gap-1.5"><i className="fa-solid fa-bolt text-brand"></i>{t('hero_trust1')}</span>
          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
          <span className="flex items-center gap-1.5"><i className="fa-solid fa-sparkles text-brand"></i>{t('hero_trust2')}</span>
        </div>
      </div>
    </section>
  )
}
