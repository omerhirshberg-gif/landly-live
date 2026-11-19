import { StyleSheet, View } from 'react-native'
import type { PurchaseMediaSource } from '@shared/offers/merchantLogo'
import MerchantBadge from './MerchantBadge'
import PerkImage from './PerkImage'
import { resolveNativePurchaseMedia } from '../lib/merchantLogo'
import { colors, radius } from '../theme'

// The business's picture in an offer summary on the order summary and the confirmation (web: the same chain in
// lib/offers/merchantLogo.ts): its logo, else the offer's photo, else nothing; never a category panel or a blank square.
// It reads the order's snapshot first, so it draws on the first frame without waiting for the offer.
export default function PurchaseMedia({ source, height = 72, category = '' }: { source: PurchaseMediaSource; height?: number; category?: string }) {
  const { logo, photoUri } = resolveNativePurchaseMedia(source)
  if (logo) return <MerchantBadge logoUri={logo.logoUri} raayonit={logo.raayonit} height={height} large />
  if (!photoUri) return null
  return (
    <View style={[styles.photo, { width: height, height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <PerkImage uri={photoUri} category={category} businessName="" />
    </View>
  )
}

const styles = StyleSheet.create({
  photo: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.borderLight },
})
