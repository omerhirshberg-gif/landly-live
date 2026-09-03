'use client'

import { useState } from 'react'
import { useLang } from '@/lib/i18n/useLang'

export default function StickyCta() {
  const { t } = useLang()
  const [dismissed, setDismissed] = useState(false)

  return (
    <div className={`sticky-cta-bar ${dismissed ? 'hidden-bar' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-white font-black text-[13.5px] truncate">{t('sticky_cta_headline')}</div>
          <div className="text-blue-200 text-[11px] truncate">{t('sticky_cta_sub')}</div>
        </div>
        <a href="#pricing" className="tap-target bg-white text-brand font-bold text-[13px] px-5 py-2.5 rounded-full whitespace-nowrap flex-shrink-0">{t('join_banner_cta')}</a>
        <button onClick={() => setDismissed(true)} className="sticky-cta-close tap-target" aria-label="Dismiss"><i className="fa-solid fa-xmark"></i></button>
      </div>
    </div>
  )
}
