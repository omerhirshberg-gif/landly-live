'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'

export default function BottomCta() {
  const { t } = useLang()

  return (
    <section className="py-4 sm:py-6 bg-slate-50">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="bg-brand rounded-3xl px-6 sm:px-10 py-10 sm:py-14 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3" style={{ letterSpacing: '-1px' }}>{t('bottomCta_title')}</h2>
          <p className="text-blue-200 text-sm sm:text-base max-w-lg mx-auto mb-7">{t('bottomCta_sub')}</p>
          <Link href="/signup" className="tap-target inline-flex items-center justify-center gap-2 bg-white text-brand font-bold text-sm px-7 py-3.5 rounded-full hover:bg-brandLight transition shadow-lg">
            <i className="fa-solid fa-sparkles"></i> <span>{t('bottomCta_btn')}</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
