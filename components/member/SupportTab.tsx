'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_LINK } from '@/lib/config'

export default function SupportTab() {
  const { t } = useLang()

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm">
      <p className="text-sm text-slate-700 leading-relaxed mb-5">{t('support_tab_intro')}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/support" className="tap-target btn-primary text-center justify-center">
          {t('support_tab_link')}
        </Link>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="tap-target flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-700 font-bold py-2.5 rounded-full hover:border-brand hover:text-brand transition text-sm">
          <i className="fa-solid fa-envelope text-xs"></i>
          <span dir="ltr">{SUPPORT_EMAIL}</span>
        </a>
        <a href={SUPPORT_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="tap-target flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-700 font-bold py-2.5 rounded-full hover:border-brand hover:text-brand transition text-sm">
          <i className="fa-brands fa-whatsapp text-xs"></i>
          <span dir="ltr">{SUPPORT_WHATSAPP_DISPLAY}</span>
        </a>
      </div>
    </div>
  )
}
