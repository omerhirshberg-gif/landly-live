import { Image, Pressable, StyleSheet, View } from 'react-native'
import { getOfferDiscountPercent, type OfferDocument } from '@shared/firebase/offers'
import { formatPrice } from '@shared/format'
import AppText from './AppText'
import { colors, radius } from '../theme'

export default function OfferCard({ offer, onPress }: { offer: OfferDocument; onPress: () => void }) {
  const discount = getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {offer.imageUrl ? (
        <Image source={{ uri: offer.imageUrl }} style={styles.image} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}
      <View style={styles.body}>
        <AppText style={styles.business}>{offer.businessName}</AppText>
        <AppText style={styles.title} numberOfLines={2}>{offer.title}</AppText>
        {!!offer.location && <AppText style={styles.location}>{offer.location}</AppText>}
        <View style={styles.priceRow}>
          <AppText style={styles.price}>{formatPrice(offer.offerPrice)}</AppText>
          {offer.originalPrice > offer.offerPrice && (
            <AppText style={styles.original}>{formatPrice(offer.originalPrice)}</AppText>
          )}
          {discount > 0 && (
            <View style={styles.badge}>
              <AppText ltr style={styles.badgeText}>-{discount}%</AppText>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    marginBottom: 16,
  },
  pressed: { opacity: 0.85 },
  image: { width: '100%', aspectRatio: 16 / 9 },
  imagePlaceholder: { backgroundColor: colors.brandLight },
  body: { padding: 16 },
  business: { fontSize: 12, fontWeight: '700', color: colors.brand, letterSpacing: 0.5, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '700', color: colors.textStrong, marginBottom: 4 },
  location: { fontSize: 13, color: colors.textMuted, marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  price: { fontSize: 18, fontWeight: '900', color: colors.textStrong },
  original: { fontSize: 14, color: colors.textFaint, textDecorationLine: 'line-through' },
  badge: { backgroundColor: colors.brandLight, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.brand },
})
