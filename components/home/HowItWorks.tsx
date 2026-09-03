'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'

export default function HowItWorks() {
  const { t } = useLang()

  return (
    <section id="how" className="py-14 sm:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="text-xs font-bold tracking-widest text-brand uppercase mb-3">{t('how_label')}</div>
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3" style={{ letterSpacing: '-1px' }}>{t('how_title')}</h2>
        <p className="text-slate-500 mb-10 sm:mb-12 max-w-lg text-[14px] sm:text-[15px]">{t('how_sub')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="step-card">
            <div className="step-num">1</div>
            <div className="text-3xl mb-3">📱</div>
            <h3 className="font-bold text-[17px] text-slate-900 mb-2">{t('step1_title')}</h3>
            <p className="text-slate-500 text-sm leading-relaxed">{t('step1_desc')}</p>
          </div>
          <div className="step-card">
            <div className="step-num">2</div>
            <div className="text-3xl mb-3">🎟️</div>
            <h3 className="font-bold text-[17px] text-slate-900 mb-2">{t('step2_title')}</h3>
            <p className="text-slate-500 text-sm leading-relaxed">{t('step2_desc')}</p>
          </div>
          <div className="step-card">
            <div className="step-num">3</div>
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-bold text-[17px] text-slate-900 mb-2">{t('step3_title')}</h3>
            <p className="text-slate-500 text-sm leading-relaxed">{t('step3_desc')}</p>
          </div>
          <Link href="/olim" className="biz-card block">
            <div className="text-4xl mb-3">✈️</div>
            <div className="text-[11px] font-bold tracking-widest uppercase mb-2 text-blue-200">{t('step4_label')}</div>
            <h3 className="font-black text-[19px] mb-2 leading-tight">{t('step4_title')}</h3>
            <p className="text-blue-100 text-sm leading-relaxed mb-5">{t('step4_desc')}</p>
            <div className="inline-flex items-center gap-2 text-sm font-bold text-white border border-white/30 rounded-full px-4 py-2">{t('step4_link')}</div>
          </Link>
        </div>
      </div>
    </section>
  )
}
