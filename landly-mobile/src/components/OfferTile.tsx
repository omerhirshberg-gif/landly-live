import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'
import { getOfferDiscountPercent, type OfferDocument } from '@shared/firebase/offers'
import { formatPrice } from '@shared/format'
import { localizeText } from '@shared/i18n/contentTranslation'
import { localizedBusinessName } from '@shared/business/businessText'
import AppText from './AppText'
import ContentText from './ContentText'
import PerkImage from './PerkImage'
import { useLang } from '../i18n/LangProvider'
import { TILE_RAIL_TILE_HEIGHT } from '../lib/carousel'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

const PRESS_SPRING = { damping: 20, stiffness: 400, mass: 0.6 }

// The Perks tab's highlight rails (OfferTileRail): a short, sideways perk
// card, 140pt tall. A framed picture on the leading side (light canvas,
// hairline border, 14pt corners, inset from the card's edges); the trailing
// side has the business, the offer (two lines at most) and the price, the
// struck-through original and the discount pill at the bottom. The whole card is the button. It fills the width
// its rail slot gives it; rows follow the root view's direction, so Hebrew puts
// the photo on the right. Same anatomy as the website's components/discover/OfferTile.tsx.
export default function OfferTile({ offer, onPress }: { offer: OfferDocument; onPress: () => void }) {
  const { t, lang } = useLang()
  const title = localizeText(offer.title, offer.translations, lang, 'title')
  const name = localizedBusinessName(offer, lang)
  const discount = getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)

  // Press feedback: a slight spring scale, skipped under Reduce Motion.
  const reduced = useReducedMotion()
  const scale = useSharedValue(1)
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))
  const pressTo = (value: number) => {
    if (!reduced) scale.set(withSpring(value, PRESS_SPRING))
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[name.text, title.text, formatPrice(offer.offerPrice)].filter(Boolean).join(', ')}
      onPress={onPress}
      onPressIn={() => pressTo(0.98)}
      onPressOut={() => pressTo(1)}
      style={webOnly({ cursor: 'pointer' })}
    >
      <Animated.View style={[styles.card, pressStyle]}>
        <View style={styles.media}>
          <PerkImage uri={offer.imageUrl} category={offer.category} businessName={name.text} />
        </View>
        <View style={styles.body}>
          <AppText style={styles.business} numberOfLines={1}>
            {name.text}
          </AppText>
          <ContentText contentLang={title.lang} style={styles.title} numberOfLines={2}>
            {title.text}
          </ContentText>
          <View style={styles.priceRow}>
            <AppText ltr style={styles.price}>{formatPrice(offer.offerPrice)}</AppText>
            {discount > 0 && <AppText ltr style={styles.original}>{formatPrice(offer.originalPrice)}</AppText>}
            {/* In the price row, never over the picture. */}
            {discount > 0 && (
              <View style={styles.discount}>
                <AppText style={styles.discountText}>{t('offer_percent_off').replace('{n}', String(discount))}</AppText>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // Web: bg-white, border #E2E8F0, rounded-2xl, shadow-sm.
  card: {
    height: TILE_RAIL_TILE_HEIGHT,
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.textStrong,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  // The framed picture, inset from the card's edges and clipped to its own corners.
  media: {
    width: 96,
    margin: 8,
    marginEnd: 0,
    borderRadius: radius.frame,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  // Web: components/discover/DiscountBadge.tsx, size 'sm'.
  discount: {
    alignSelf: 'center',
    backgroundColor: colors.discount,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  discountText: { fontSize: 11, fontWeight: '800', color: colors.white, letterSpacing: 0.3, textTransform: 'uppercase' },
  body: { flex: 1, minWidth: 0, padding: 12 },
  business: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: colors.heading },
  title: { fontSize: 13, lineHeight: 18, color: colors.body, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6, rowGap: 2, marginTop: 'auto' },
  price: { fontSize: 16, fontWeight: '800', color: colors.brand },
  original: { fontSize: 12, color: colors.textFaint, textDecorationLine: 'line-through' },
})
