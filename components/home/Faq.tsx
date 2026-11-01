'use client'

import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { useLang } from '@/lib/i18n/useLang'
import { LANDING_COLUMN } from '@/components/landing/landingColumn'

interface FaqItemData {
  q: string
  body: React.ReactNode
}

export default function Faq() {
  const { t } = useLang()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const baseId = useId()

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
      <div className={LANDING_COLUMN}>
        <div className="mb-8 text-center sm:mb-10">
          <div className="text-xs font-bold tracking-widest text-brand uppercase mb-3">{t('faq_label')}</div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">{t('faq_title')}</h2>
        </div>
        <div className="mx-auto max-w-3xl space-y-3 sm:space-y-4">
          {items.map((item, i) => {
            const open = openIndex === i
            const buttonId = `${baseId}-q${i}`
            const panelId = `${baseId}-a${i}`
            return (
              <div key={i} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:rounded-3xl">
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl p-5 text-start font-bold text-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:rounded-3xl sm:p-6 [@media(hover:hover)]:hover:text-brand"
                  onClick={() => setOpenIndex(open ? null : i)}
                >
                  <span className="text-sm sm:text-base">{item.q}</span>
                  <span aria-hidden="true" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-200/80">
                    <ChevronDown className={`acc-icon h-4 w-4 text-brand ${open ? 'open' : ''}`} strokeWidth={1.75} />
                  </span>
                </button>
                <div id={panelId} role="region" aria-labelledby={buttonId} className={`acc-body ${open ? 'open' : ''}`}>
                  <div>
                    <div className="px-5 pb-5 text-meta leading-relaxed text-body sm:px-6 sm:pb-6 sm:text-sm">
                      {item.body}
                    </div>
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
