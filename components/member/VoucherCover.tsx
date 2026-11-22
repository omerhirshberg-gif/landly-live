'use client'

import { useRaayonitDisplay } from '@/lib/flags/raayonitDisplayStore'
import DealMedia from '@/components/discover/DealMedia'
import { isRaayonitOffer, logoOnlyHero, raayonitImageOpts } from '@/lib/offers/logoOnly'
import { RAAYONIT_LOGO_PATH } from '@/lib/payments/issuer'
import MerchantBadge from '@/components/discover/MerchantBadge'
import { useDealImage } from '@/components/discover/useDealImage'
import { badgeLogoUri } from '@/lib/offers/dealImage'
import { useVoucherOffer } from '@/lib/member/useVoucherOffer'
import type { VoucherDocument } from '@/lib/firebase/vouchers'
import { voucherFaceValueText } from '@/lib/vouchers/redemptionProgress'

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
  voucher: Pick<VoucherDocument, 'offerId' | 'businessName'> & Partial<Pick<VoucherDocument, 'amountAgorot' | 'faceValueAgorot' | 'savingsAgorot'>>
  /** The business's name as shown (its translation); the logo's fallback initial. */
  name: string
  aspect?: string
  logoSize?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const offer = useVoucherOffer(voucher.offerId)
  const src = offer?.imageUrl ?? ''
  const image = useDealImage(src, raayonitImageOpts(offer))
  const faceValue = voucherFaceValueText(voucher)
  const hero = offer ? logoOnlyHero(offer) : null
  const display = useRaayonitDisplay()
  // Raayonit's own logo is never the cover until its written approval is switched on.
  const heroLogo = hero && (display || hero.kind !== 'issuer') ? { src: hero.kind === 'issuer' ? RAAYONIT_LOGO_PATH : hero.logoUrl, alt: name } : null
  return (
    <DealMedia src={src} image={image} alt="" category={offer?.category ?? ''} logo={heroLogo} aspect={aspect} className={`rounded-t-[inherit] ${className}`}>
      {/* The gift card's value, in the cover's bottom end corner (the logo has the start one). */}
      {faceValue && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-end bg-gradient-to-t from-slate-900/45 to-transparent px-4 pb-2.5 pt-8">
          <bdi dir="ltr" className="text-[26px] font-extrabold leading-none tracking-tight text-white tabular-nums drop-shadow-sm">{faceValue}</bdi>
        </span>
      )}
      {!heroLogo && !isRaayonitOffer(offer) && <span className={`absolute start-3 ${logoSize === 'sm' ? '-bottom-4' : '-bottom-5 sm:-bottom-6'}`}>
        <MerchantBadge logoUrl={badgeLogoUri(offer?.businessLogoUrl ?? '', src, image.role) ?? ''} size={logoSize} />
      </span>}
    </DealMedia>
  )
}
