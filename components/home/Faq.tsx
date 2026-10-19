'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useLang } from '@/lib/i18n/useLang'

interface FaqItemData {
  q: string
  body: React.ReactNode
}

export default function Faq() {
  const { t } = useLang()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const items: FaqItemData[] = [
    { q: t('faq1_q'), body: <>{t('faq1_a')}</> },
    { q: t('faq4_q'), body: <>{t('faq4_a')}</> },
    {
      q: t('faq5_q'),
      body: (
        <>
          <span>{t('faq5_a')}</span> <span>{t('faq_see_full')}</span>{' '}
          <Link href="/terms" className="text-brand underline font-semibold">{t('terms_link')}</Link>.
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
    <section id="faq" className="py-14 sm:py-20">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="text-xs font-bold tracking-widest text-brand uppercase mb-3">{t('faq_label')}</div>
        <h2 className="text-2xl sm:text-3xl font-bold text-ink mb-10">{t('faq_title')}</h2>
        <div className="max-w-3xl space-y-3">
          {items.map((item, i) => {
            const open = openIndex === i
            return (
              <div key={i} className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                <button
                  className="w-full flex justify-between items-center gap-3 px-5 sm:px-6 py-4 sm:py-5 text-start font-bold text-ink hover:text-brand transition"
                  onClick={() => setOpenIndex(open ? null : i)}
                >
                  <span className="text-sm sm:text-base">{item.q}</span>
                  <i className={`fa-solid fa-chevron-down acc-icon text-brand text-sm flex-shrink-0 ${open ? 'open' : ''}`} aria-hidden="true"></i>
                </button>
                <div className={`acc-body ${open ? 'open' : ''}`}>
                  <div className="px-5 sm:px-6 pb-5 text-body text-[13.5px] sm:text-[14px] leading-relaxed">
                    {item.body}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
