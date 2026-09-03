import { useLang } from '@/lib/i18n/useLang'

export default function RedeemedTab() {
  const { t } = useLang()

  return (
    <div className="dash-empty-state">
      <i className="fa-solid fa-receipt"></i>
      <div className="font-bold text-slate-700 text-base mb-1">{t('dash_redeemed_empty_title')}</div>
      <p className="text-sm text-slate-500 max-w-xs">{t('dash_redeemed_empty_sub')}</p>
    </div>
  )
}
