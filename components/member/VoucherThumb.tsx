'use client'

import PerkImage from '@/components/discover/PerkImage'
import { useVoucherOffer } from '@/lib/member/useVoucherOffer'
import type { VoucherDocument } from '@/lib/firebase/vouchers'

// A My Pass card's thumbnail: the offer's photo, or PerkImage's branded panel
// when it has none (or the offer is gone). A plain tinted square while the
// offer loads, so the card never shifts. 64px on phones, 80px from sm up; the
// card's own row puts it on the reading direction's start side.
export default function VoucherThumb({ voucher, muted = false }: { voucher: Pick<VoucherDocument, 'offerId' | 'businessName'>; muted?: boolean }) {
  const offer = useVoucherOffer(voucher.offerId)

  return (
    <div
      className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-[#F0F7FF] sm:h-20 sm:w-20 ${
        muted ? 'opacity-75 grayscale-[40%]' : ''
      }`}
    >
      {offer !== undefined && (
        <PerkImage
          src={offer?.imageUrl ?? ''}
          alt=""
          category={offer?.category ?? ''}
          businessName={voucher.businessName}
          size="thumb"
        />
      )}
    </div>
  )
}
