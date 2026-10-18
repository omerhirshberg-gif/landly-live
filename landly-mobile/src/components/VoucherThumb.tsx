import { StyleSheet, View } from 'react-native'
import type { VoucherDocument } from '@shared/firebase/vouchers'
import { useVoucherOffer } from '@shared/member/useVoucherOffer'
import PerkImage from './PerkImage'
import { colors, radius } from '../theme'

// A My Pass card's 68pt thumbnail (web: components/member/VoucherThumb.tsx):
// the offer's photo, or PerkImage's branded panel when it has none (or the
// offer is gone). A plain tinted square while the offer loads, so the card
// never shifts. The card's row puts it on the reading direction's start side.
// React Native has no grayscale filter on iOS, so `muted` fades it instead.
export default function VoucherThumb({ voucher, muted = false }: { voucher: Pick<VoucherDocument, 'offerId' | 'businessName'>; muted?: boolean }) {
  const offer = useVoucherOffer(voucher.offerId)
  return (
    <View style={[styles.thumb, muted && styles.muted]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {offer !== undefined && (
        <PerkImage uri={offer?.imageUrl ?? ''} category={offer?.category ?? ''} businessName={voucher.businessName} size="thumb" />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  thumb: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.brandTint,
    overflow: 'hidden',
  },
  muted: { opacity: 0.6 },
})
