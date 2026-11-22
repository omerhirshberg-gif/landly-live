'use client'

import { CalendarCheck, CalendarX } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { formatLongDate } from '@/lib/format'
import type { VoucherDocument } from '@/lib/firebase/vouchers'
import { localizeText, type LocalizedText } from '@/lib/i18n/contentTranslation'

// A voucher's validity and redemption terms, as frozen when it was bought.
// Shared by the voucher page and the checkout success page; the mobile
// VoucherPass shows the same two lines. The terms are in the reader's
// language when the voucher carries a translation; a page with a "Show
// original" switch passes the text it chose as `terms`.
export default function VoucherTerms({
  voucher,
  terms: shownTerms,
  hideExpiry = false,
}: {
  voucher: Pick<VoucherDocument, 'expiresAt' | 'redemptionTerms' | 'translations'>
  terms?: LocalizedText
  /** The page already shows the expiry (the voucher page's ticket), so only the terms are drawn. */
  hideExpiry?: boolean
}) {
  const { t, lang } = useLang()
  const terms = shownTerms ?? localizeText(voucher.redemptionTerms, voucher.translations, lang, 'redemptionTerms')
  const expired = !!voucher.expiresAt && voucher.expiresAt.getTime() < Date.now()

  return (
    <>
      {voucher.expiresAt && !hideExpiry && (
        <p className={`flex items-center gap-2 text-xs font-semibold ${expired ? 'text-red-600' : 'text-slate-600'}`}>
          {expired ? <CalendarX aria-hidden="true" className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.75} /> : <CalendarCheck aria-hidden="true" className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.75} />}
          <span>{t(expired ? 'voucher_expired_on' : 'voucher_valid_until').replace('{date}', formatLongDate(voucher.expiresAt, lang))}</span>
        </p>
      )}
      {terms.text && (
        <div className={hideExpiry ? '' : 'mt-3'}>
          <h3 className="text-xs font-bold text-slate-700 mb-1">{t('voucher_redemption_terms_label')}</h3>
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line" lang={terms.lang ?? undefined} dir="auto">{terms.text}</p>
        </div>
      )}
    </>
  )
}
