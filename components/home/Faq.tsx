'use client'

import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
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
    <section id="faq" className="py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="text-xs font-bold tracking-widest text-brand uppercase mb-3">{t('faq_label')}</div>
        <h2 className="text-2xl sm:text-3xl font-bold text-ink mb-10">{t('faq_title')}</h2>
        <div className="max-w-3xl space-y-3">
          {items.map((item, i) => {
            const open = openIndex === i
            return (
              <div key={i} className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-card">
                <button
                  className="w-full flex justify-between items-center gap-3 px-5 sm:px-6 py-4 sm:py-5 text-start font-bold text-ink hover:text-brand transition"
                  onClick={() => setOpenIndex(open ? null : i)}
                >
                  <span className="text-sm sm:text-base">{item.q}</span>
                  <ChevronDown aria-hidden="true" className={`acc-icon h-4 w-4 flex-shrink-0 text-brand ${open ? 'open' : ''}`} strokeWidth={1.75} />
                </button>
                <div className={`acc-body ${open ? 'open' : ''}`}>
                  <div className="px-5 sm:px-6 pb-5 text-body text-meta sm:text-sm leading-relaxed">
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
