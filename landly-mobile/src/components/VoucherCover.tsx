import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import type { VoucherDocument } from '@shared/firebase/vouchers'
import { useVoucherOffer } from '@shared/member/useVoucherOffer'
import DealMedia from './DealMedia'
import MerchantBadge from './MerchantBadge'
import { badgeLogoUri, businessInitial, secureImageUrl } from '../lib/imageSource'
import { useDealImage } from '../lib/useDealImage'

// A pass's cover (My Pass cards, the voucher screen): the offer's photo, or
// the category's branded panel while it loads or when it has none, with the
// business's squircle logo across the bottom start corner, 16pt of it hanging
// over whatever sits below (that body clears it). The voucher carries neither
// picture, so both come from its offer (useVoucherOffer: one cached read per
// offer, shared by every card) with no change to the voucher itself.
// Web: components/member/VoucherCover.tsx.
export default function VoucherCover({
  voucher,
  name,
  ratio = 16 / 9,
  maxHeight,
  logoHeight = 40,
  style,
}: {
  voucher: Pick<VoucherDocument, 'offerId' | 'businessName'>
  /** The business's name as shown (its translation); the logo's fallback initial. */
  name: string
  ratio?: number
  maxHeight?: number
  logoHeight?: number
  style?: StyleProp<ViewStyle>
}) {
  const offer = useVoucherOffer(voucher.offerId)
  const image = useDealImage(offer?.imageUrl ?? '')
  return (
    <DealMedia image={image} category={offer?.category ?? ''} ratio={ratio} maxHeight={maxHeight}>
      <MerchantBadge
        logoUri={badgeLogoUri(secureImageUrl(offer?.businessLogoUrl ?? ''), image.uri, image.role)}
        initial={businessInitial(name)}
        height={logoHeight}
        style={[styles.logo, { bottom: -logoHeight * 0.4 }, style]}
      />
    </DealMedia>
  )
}

const styles = StyleSheet.create({
  logo: { position: 'absolute', start: 12 },
})
