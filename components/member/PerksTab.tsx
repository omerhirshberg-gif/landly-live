'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { getUserVouchers, VoucherDocument } from '@/lib/firebase/vouchers'
import VoucherQRCode from './VoucherQRCode'

type ActiveVoucher = VoucherDocument & { id: string }

export default function PerksTab() {
  const { t } = useLang()
  const { user } = useAuth()
  const [vouchers, setVouchers] = useState<ActiveVoucher[] | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getUserVouchers(user.uid, 'active').then((result) => {
      if (!cancelled) setVouchers(result)
    })
    return () => { cancelled = true }
  }, [user])

  if (vouchers === null) {
    return <div className="dash-empty-state" />
  }

  if (vouchers.length === 0) {
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
              <p className="text-xs text-slate-400 mt-2 max-w-[220px]">{t('voucher_qr_label')}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
