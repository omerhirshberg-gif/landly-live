import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import type { VoucherDocument } from '@shared/firebase/vouchers'
import { useVoucherOffer } from '@shared/member/useVoucherOffer'
import { voucherFaceValueText } from '@shared/vouchers/redemptionProgress'
import AppText from './AppText'
import { heroLogoSource, isRaayonitOffer, raayonitImageOpts } from '../lib/logoHero'
import DealMedia from './DealMedia'
import MerchantBadge from './MerchantBadge'
import { badgeLogoUri, secureImageUrl } from '../lib/imageSource'
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
  ratio = 16 / 9,
  maxHeight,
  logoHeight = 40,
  style,
}: {
  voucher: Pick<VoucherDocument, 'offerId' | 'businessName'> & Partial<Pick<VoucherDocument, 'amountAgorot' | 'faceValueAgorot' | 'savingsAgorot'>>
  ratio?: number
  maxHeight?: number
  logoHeight?: number
  style?: StyleProp<ViewStyle>
}) {
  const offer = useVoucherOffer(voucher.offerId)
  const faceValue = voucherFaceValueText(voucher)
  const image = useDealImage(offer?.imageUrl ?? '', raayonitImageOpts(offer))
  return (
    <DealMedia image={image} category={offer?.category ?? ''} logo={heroLogoSource(offer)} ratio={ratio} maxHeight={maxHeight}>
      {/* The gift card's value, in the cover's bottom end corner (the logo has the start one) over a soft fade. */}
      {faceValue && (
        <View pointerEvents="none" style={styles.valueFade}>
          <AppText ltr style={styles.value}>{faceValue}</AppText>
        </View>
      )}
      {!heroLogoSource(offer) && !isRaayonitOffer(offer) && <MerchantBadge
        logoUri={badgeLogoUri(secureImageUrl(offer?.businessLogoUrl ?? ''), image.uri, image.role)}
        height={logoHeight}
        style={[styles.logo, { bottom: -logoHeight * 0.4 }, style]}
      />}
    </DealMedia>
  )
}

const styles = StyleSheet.create({
  logo: { position: 'absolute', start: 12 },
  valueFade: { position: 'absolute', start: 0, end: 0, bottom: 0, alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 32, paddingBottom: 10, experimental_backgroundImage: 'linear-gradient(to top, rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0))' },
  value: { fontSize: 26, lineHeight: 28, fontWeight: '800', letterSpacing: -0.3, color: '#FFFFFF', fontVariant: ['tabular-nums'], textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
})
