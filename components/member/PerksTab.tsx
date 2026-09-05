'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'

export default function PerksTab() {
  const { t } = useLang()

  return (
    <div>
      <div className="dash-empty-state">
        <i className="fa-solid fa-gift"></i>
        <div className="font-bold text-slate-700 text-base mb-1">{t('dash_perks_empty_title')}</div>
        <p className="text-sm text-slate-500 max-w-xs mb-5">{t('dash_perks_empty_sub')}</p>
        <Link href="/categories" className="tap-target btn-primary">
          <span>{t('nav_cta')}</span>
        </Link>
      </div>
    </div>
  )
}
