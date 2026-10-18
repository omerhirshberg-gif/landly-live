'use client'

import { useLang } from '@/lib/i18n/useLang'
import { formatLongDate } from '@/lib/format'
import type { VoucherDocument } from '@/lib/firebase/vouchers'

// A voucher's validity and redemption terms, as frozen when it was bought.
// Shared by the wallet (PerksTab) and the checkout success page; the mobile
// VoucherPass shows the same two lines.
export default function VoucherTerms({ voucher }: { voucher: Pick<VoucherDocument, 'expiresAt' | 'redemptionTerms'> }) {
  const { t, lang } = useLang()
  const expired = !!voucher.expiresAt && voucher.expiresAt.getTime() < Date.now()

  return (
    <>
      {voucher.expiresAt && (
        <p className={`flex items-center gap-2 text-xs font-semibold ${expired ? 'text-red-600' : 'text-slate-600'}`}>
          <i className={`fa-regular ${expired ? 'fa-calendar-xmark' : 'fa-calendar-check'}`} aria-hidden="true"></i>
          <span>{t(expired ? 'voucher_expired_on' : 'voucher_valid_until').replace('{date}', formatLongDate(voucher.expiresAt, lang))}</span>
        </p>
      )}
      {voucher.redemptionTerms && (
        <div className="mt-3">
          <h3 className="text-xs font-bold text-slate-700 mb-1">{t('voucher_redemption_terms_label')}</h3>
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{voucher.redemptionTerms}</p>
        </div>
      )}
    </>
  )
}
