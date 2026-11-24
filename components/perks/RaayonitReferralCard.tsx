'use client'

import Link from 'next/link'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import type { OfferDocument } from '@/lib/firebase/offers'
import { localizedBusinessName } from '@/lib/business/businessText'
import { isolateLtr } from '@/lib/home/superShowcase'
import { useLang } from '@/lib/i18n/useLang'
import { webOfferPath } from '@/lib/offers/offerRoutes'
import { roundedCount } from '@/lib/offers/raayonitPreview'
import { REFERRAL_KEYS, referralHeadline, referralSummary, referralTarget } from '@/lib/perks/raayonitReferral'

// A search with no GoLandly perk that names a business honouring the Raayonit Card (native: landly-mobile/src/components/RaayonitReferralCard.tsx):
// one compact white card, a line badge, the venue's name, one sentence on the card and "View card". One match opens that venue; several open the hub
// with the search filled in. `chainCount` is the live number of chains (rounded down to a whole ten, as everywhere else).
export default function RaayonitReferralCard({ matches, query, chainCount, className = '' }: { matches: OfferDocument[]; query: string; chainCount: number; className?: string }) {
  const { t, lang } = useLang()
  const summary = referralSummary(matches, (o) => localizedBusinessName(o, lang).text)
  const target = referralTarget(matches, query)
  if (!summary || !target) return null
  const { before, after } = referralHeadline(t(summary.others > 0 ? REFERRAL_KEYS.more : REFERRAL_KEYS.one), summary.others)
  const href = target.kind === 'offer' ? webOfferPath(target.offer.id) : target.path
  return (
    <Link
      href={href}
      className={`group flex min-h-11 items-start gap-3 sm:max-w-xl rounded-xl border border-[#E2E8F0] bg-white p-3.5 transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] ${className}`}
    >
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/60 text-brand">
        <ArrowUpRight className="h-5 w-5 rtl:-scale-x-100" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold leading-snug tracking-tight text-ink">{before}<bdi dir="auto">{summary.venue}</bdi>{after}</span>
        <span className="mt-0.5 block text-[13px] leading-[18px] text-body">{t(REFERRAL_KEYS.sub).replace('{count}+', isolateLtr(`${roundedCount(chainCount)}+`))}</span>
        <span className="mt-1.5 inline-flex items-center gap-0.5 text-[13px] font-bold text-brand">
          {t(REFERRAL_KEYS.cta)}
          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 rtl:-scale-x-100" strokeWidth={2} />
        </span>
      </span>
    </Link>
  )
}
