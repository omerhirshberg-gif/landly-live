import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'

export default function PerksTab() {
  const { t } = useLang()

  return (
    <div>
      <div className="space-y-4 mb-4">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 flex items-center gap-4 sm:gap-5 shadow-sm">
          <div className="qr-box"></div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-900 text-sm sm:text-base">Pasta Nostra 20% Off</div>
            <div className="text-xs sm:text-sm text-slate-500 mt-1">TLV, Rothschild Boulevard</div>
            <div className="text-xs text-red-500 mt-2 font-semibold"><span>{t('perks_expires')}</span> March 31, 2025</div>
          </div>
          <button className="tap-target bg-brand text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-full flex-shrink-0 shadow">{t('perks_show_qr')}</button>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 flex items-center gap-4 sm:gap-5 shadow-sm">
          <div className="qr-box"></div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-900 text-sm sm:text-base">Holmes Place 30% Off</div>
            <div className="text-xs sm:text-sm text-slate-500 mt-1">Multiple locations</div>
            <div className="text-xs text-orange-500 mt-2 font-semibold"><span>{t('perks_expires')}</span> April 15, 2025</div>
          </div>
          <button className="tap-target bg-brand text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-full flex-shrink-0 shadow">{t('perks_show_qr')}</button>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 flex items-center gap-4 sm:gap-5 shadow-sm">
          <div className="qr-box"></div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-900 text-sm sm:text-base">Surf Club Israel 20% Off</div>
            <div className="text-xs sm:text-sm text-slate-500 mt-1">Hilton Beach</div>
            <div className="text-xs text-emerald-600 mt-2 font-semibold"><span>{t('perks_expires')}</span> June 30, 2025</div>
          </div>
          <button className="tap-target bg-brand text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-full flex-shrink-0 shadow">{t('perks_show_qr')}</button>
        </div>
      </div>
      <div className="text-center mb-4">
        <Link href="/#deals" className="tap-target inline-flex items-center gap-2 bg-brand text-white font-bold px-8 py-3 rounded-full hover:bg-brandDark transition shadow-md">
          <i className="fa-solid fa-plus"></i> <span>{t('perks_browse_more')}</span>
        </Link>
      </div>
    </div>
  )
}
