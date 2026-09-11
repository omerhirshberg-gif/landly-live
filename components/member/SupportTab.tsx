'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'

export default function SupportTab() {
  const { t } = useLang()

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm">
      <p className="text-sm text-slate-700 leading-relaxed mb-5">{t('support_tab_intro')}</p>
      <Link href="/support" className="tap-target btn-primary text-center justify-center">
        {t('support_tab_link')}
      </Link>
    </div>
  )
}
