'use client'

import { Globe, Phone } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { firstPhone, normalizeWebsiteUrl } from '@/lib/offers/contact'

// The business's own website and, for a single-location business, its phone: two quiet buttons under an offer's (or voucher's) header.
// Each shows only when the card has the field; the number is isolated left-to-right inside a right-to-left page.
// Expo: landly-mobile/src/components/ContactActions.tsx.
export default function ContactActions({ websiteUrl, phone, className = '', stack = false, row = false }: { websiteUrl?: string; phone?: string; className?: string; stack?: boolean; row?: boolean }) {
  const { t } = useLang()
  const site = normalizeWebsiteUrl(websiteUrl)
  const call = firstPhone(phone)
  if (!site && !call) return null
  // `stack`: a full-width, 52px row in a column (the offer page's and the voucher's action stack), the label centred.
  // `row`: the business card's two equal 44px buttons side by side (one alone takes the full width).
  const button = `${row ? 'flex min-h-11 min-w-0 flex-1 basis-0 justify-center rounded-xl !border-[#CBD5E1] [&>bdi]:truncate' : stack ? 'flex min-h-[52px] w-full justify-center rounded-2xl' : 'inline-flex min-h-11 rounded-[14px]'} items-center gap-2 border border-slate-200 bg-white px-3.5 text-sm font-bold text-brand transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20`
  return (
    <div className={`${row ? 'flex w-full gap-2.5' : stack ? 'flex flex-col gap-3' : 'flex flex-wrap gap-2.5'} ${className}`}>
      {site && (
        <a href={site} target="_blank" rel="noopener noreferrer" aria-label={t('offer_visit_website')} className={button}>
          <Globe aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          {t('offer_visit_website')}
        </a>
      )}
      {call && (
        <a href={call.href} aria-label={`${t('offer_call')} ${call.display}`} className={button}>
          <Phone aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          <bdi dir="ltr">{call.display}</bdi>
        </a>
      )}
    </div>
  )
}
