'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useLang } from '@/lib/i18n/useLang'

interface FaqItemData {
  q: string
  body: React.ReactNode
}

export default function Faq({
  onOpenTerms,
  onOpenRaffleTerms,
}: {
  onOpenTerms: () => void
  onOpenRaffleTerms: () => void
}) {
  const { t } = useLang()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const items: FaqItemData[] = [
    { q: t('faq1_q'), body: <>{t('faq1_a')}</> },
    {
      q: t('faq3_q'),
      body: (
        <>
          <span>{t('faq3_a')}</span> <span>{t('faq_see_full_details')}</span>{' '}
          <button onClick={onOpenRaffleTerms} className="text-brand underline font-semibold">{t('terms_link')}</button>.
        </>
      ),
    },
    { q: t('faq4_q'), body: <>{t('faq4_a')}</> },
    {
      q: t('faq5_q'),
      body: (
        <>
          <span>{t('faq5_a')}</span> <span>{t('faq_see_full')}</span>{' '}
          <button onClick={onOpenTerms} className="text-brand underline font-semibold">{t('terms_link')}</button>.
        </>
      ),
    },
    {
      q: t('faq6_q'),
      body: (
        <>
          <span>{t('faq6_a_pre')}</span>{' '}
          <Link href="/support" className="text-brand underline font-semibold">{t('faq6_link')}</Link>
          <span>{t('faq6_a_post')}</span>
        </>
      ),
    },
  ]

  return (
    <section id="faq" className="py-14 sm:py-20 bg-white">
      <div className="max-w-3xl mx-auto px-5 sm:px-6">
        <div className="text-xs font-bold tracking-widest text-brand uppercase mb-3">{t('faq_label')}</div>
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-10" style={{ letterSpacing: '-1px' }}>{t('faq_title')}</h2>
        <div className="space-y-3">
          {items.map((item, i) => {
            const open = openIndex === i
            return (
              <div key={i} className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                <button
                  className="w-full flex justify-between items-center gap-3 px-5 sm:px-6 py-4 sm:py-5 text-left font-bold text-slate-800 hover:text-brand transition"
                  onClick={() => setOpenIndex(open ? null : i)}
                >
                  <span className="text-sm sm:text-base">{item.q}</span>
                  <i className={`fa-solid fa-chevron-down acc-icon text-brand text-sm flex-shrink-0 ${open ? 'open' : ''}`}></i>
                </button>
                <div className={`acc-body px-5 sm:px-6 pb-5 text-slate-500 text-[13.5px] sm:text-[14px] leading-relaxed ${open ? 'open' : ''}`}>
                  {item.body}
                </div>
              </div>
            )
          })}
        </div>

        {/* JOIN CTA — high-intent scroll point #3 (end of FAQ) */}
        <div className="join-cta-banner mt-10">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-circle-check text-brand text-xl flex-shrink-0"></i>
            <div>
              <p className="font-bold text-slate-900 text-sm sm:text-base">{t('join_banner2_headline')}</p>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">{t('join_banner2_sub')}</p>
            </div>
          </div>
          <a href="#pricing" className="tap-target bg-brand text-white font-bold text-sm px-6 py-3 rounded-full hover:bg-brandDark transition shadow-md flex-shrink-0">{t('join_banner_cta')}</a>
        </div>
      </div>
    </section>
  )
}
