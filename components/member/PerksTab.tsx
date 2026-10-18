'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'
import type { VoucherDocument } from '@/lib/firebase/vouchers'
import VoucherQRCode from './VoucherQRCode'
import VoucherTerms from './VoucherTerms'

type ActiveVoucher = VoucherDocument & { id: string }

// My Perks on /member: each active voucher as a scannable pass. The page
// owns the live list (shared with the stats row); null while it loads.
export default function PerksTab({ vouchers }: { vouchers: ActiveVoucher[] | null }) {
  const { t } = useLang()

  if (vouchers === null) {
    return (
      <div role="status" className="dash-empty-state">
        <span className="sr-only">{t('bizdash_loading')}</span>
      </div>
    )
  }

  if (vouchers.length === 0) {
    return (
      <div>
        <div className="dash-empty-state">
          <i className="fa-solid fa-gift" aria-hidden="true"></i>
          <div className="font-bold text-slate-700 text-base mb-1">{t('dash_perks_empty_title')}</div>
          <p className="text-sm text-slate-500 max-w-xs mb-5">{t('dash_perks_empty_sub')}</p>
          <Link href="/categories" className="tap-target btn-primary">
            <span>{t('nav_cta')}</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {vouchers.map((voucher) => (
        <div key={voucher.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold tracking-widest text-brand uppercase mb-1">{voucher.businessName}</div>
          <div className="font-bold text-slate-900 mb-4">{voucher.offerTitle}</div>
          <div className="flex flex-col sm:flex-row items-center gap-4 border-t border-slate-100 pt-4">
            <VoucherQRCode voucherId={voucher.id} />
            <div className="text-center sm:text-start">
              <div className="text-xs text-slate-500 mb-1">{t('voucher_redemption_code_label')}</div>
              <div className="text-2xl font-black text-slate-900 tracking-[0.2em]" dir="ltr">{voucher.redemptionCode}</div>
              <p className="text-xs text-slate-500 mt-2 max-w-[220px]">{t('voucher_qr_label')}</p>
            </div>
          </div>
          {(voucher.expiresAt || voucher.redemptionTerms) && (
            <div className="border-t border-slate-100 mt-4 pt-4">
              <VoucherTerms voucher={voucher} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
