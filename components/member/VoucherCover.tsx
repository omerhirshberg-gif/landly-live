'use client'

import DealMedia from '@/components/discover/DealMedia'
import MerchantBadge from '@/components/discover/MerchantBadge'
import { useDealImage } from '@/components/discover/useDealImage'
import { badgeLogoUri } from '@/lib/offers/dealImage'
import { useVoucherOffer } from '@/lib/member/useVoucherOffer'
import type { VoucherDocument } from '@/lib/firebase/vouchers'

// A pass's cover (My Pass cards, the voucher page; the app: VoucherCover.tsx):
// the offer's photo, or the category's branded panel while it loads or when it
// has none, with the business's squircle logo across the bottom start corner,
// hanging over whatever sits below (that body clears it). The voucher carries
// neither picture, so both come from its offer (useVoucherOffer: one cached
// read per offer) with no change to the voucher itself.
export default function VoucherCover({
  voucher,
  name,
  aspect = 'aspect-video max-h-[148px]',
  logoSize = 'sm',
  className = '',
}: {
  voucher: Pick<VoucherDocument, 'offerId' | 'businessName'>
  /** The business's name as shown (its translation); the logo's fallback initial. */
  name: string
  aspect?: string
  logoSize?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const offer = useVoucherOffer(voucher.offerId)
  const src = offer?.imageUrl ?? ''
  const image = useDealImage(src)
  return (
    <DealMedia src={src} image={image} alt="" category={offer?.category ?? ''} aspect={aspect} className={`rounded-t-[inherit] ${className}`}>
      <span className={`absolute start-3 ${logoSize === 'sm' ? '-bottom-4' : '-bottom-5 sm:-bottom-6'}`}>
        <MerchantBadge logoUrl={badgeLogoUri(offer?.businessLogoUrl ?? '', src, image.role) ?? ''} businessName={name} size={logoSize} />
      </span>
    </DealMedia>
  )
}
