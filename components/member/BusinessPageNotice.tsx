'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpLeft, ArrowUpRight, Store } from 'lucide-react'
import FindBusinessDialog from '@/components/member/FindBusinessDialog'
import { useLang } from '@/lib/i18n/useLang'
import { isChain } from '@/lib/offers/discoverTab'
import { webOfferPath } from '@/lib/offers/offerRoutes'
import { useOffers } from '@/lib/offers/useOffers'

// Under a pass's general "How to redeem" steps: those are the site's general terms, and each business has its own exact details on its
// page, so the buyer is sent there before going. The button opens a popup on the pass itself: a multi-chain pass searches the businesses that
// honour it and shows the picked one's own steps and terms; a single-business pass opens straight on its business. Native: landly-mobile/src/components/BusinessPageNotice.tsx.
export default function BusinessPageNotice({ offerId, multiChain, className = '' }: { offerId: string; multiChain: boolean; className?: string }) {
  const { t } = useLang()
  const router = useRouter()
  const { offers } = useOffers()
  const [open, setOpen] = useState(false)
  const chains = useMemo(() => (offers ?? []).filter(isChain), [offers])
  const own = useMemo(() => (offers ?? []).find((o) => o.id === offerId), [offers, offerId])
  // A single-business pass whose live offer can't be read falls back to its page.
  const onOpen = () => (multiChain || own ? setOpen(true) : router.push(webOfferPath(offerId)))
  return (
    <div className={`rounded-2xl border border-brand/20 bg-gradient-to-br from-brandTint to-white p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10">
          <Store className="h-5 w-5 text-brand" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-snug text-ink">{t('voucher_biz_notice_title')}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-body">{t('voucher_biz_notice_body')}</p>
        </div>
      </div>
      <button type="button" onClick={onOpen} aria-haspopup="dialog" className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white transition-colors hover:bg-brandHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        {t(multiChain ? 'voucher_biz_notice_cta_hub' : 'voucher_biz_notice_cta')}
        <ArrowUpRight aria-hidden="true" className="h-4 w-4 rtl:hidden" strokeWidth={2} />
        <ArrowUpLeft aria-hidden="true" className="hidden h-4 w-4 rtl:block" strokeWidth={2} />
      </button>
      {open && <FindBusinessDialog chains={chains} only={multiChain ? undefined : own} onClose={() => setOpen(false)} />}
    </div>
  )
}
