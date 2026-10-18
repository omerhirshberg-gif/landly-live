import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { CATEGORY_TILES } from '@shared/categories'
import { getOffer, getOfferDiscountPercent, type OfferDocument } from '@shared/firebase/offers'
import { hasUserClaimedOffer } from '@shared/firebase/vouchers'
import { useAuth } from '@shared/firebase/useAuth'
import { useWishlist } from '@shared/firebase/useWishlist'
import { formatLongDate, formatPrice } from '@shared/format'
import { REDEMPTION_METHOD_LABEL_KEYS, redemptionSteps } from '@shared/offers/redemption'
import AppText from '../../components/AppText'
import Button from '../../components/Button'
import LineIcon from '../../components/LineIcon'
import { REDEMPTION_METHOD_ICONS } from '../../components/OfferCard'
import PerkImage from '../../components/PerkImage'
import ScreenHeader from '../../components/ScreenHeader'
import { useLang } from '../../i18n/LangProvider'
import { cachedOffer } from '../../lib/openOffer'
import { webOnly } from '../../lib/webStyles'
import { colors, radius } from '../../theme'

// One offer as its own screen (web: /offers/[offerId]), pushed from a perk
// card as a page flip (lib/pageFlip.ts): a full-screen swipe in the reading
// direction turns it back, the same as the header's back button. The photo
// with the wishlist heart, the business, the offer and its price, the
// description, validity and how to redeem; the Buy button sits in a bar
// pinned above the home indicator. Buy pushes the native checkout
// (app/checkout/[offerId].tsx); a finished purchase replaces it with the new
// voucher, so coming back here re-runs the claim check on focus, turning the
// Buy bar into the "already claimed" notice.
export default function OfferScreen() {
  const { t, lang } = useLang()
  const insets = useSafeAreaInsets()
  const { offerId } = useLocalSearchParams<{ offerId: string }>()
  const { user } = useAuth()
  const { isWishlisted, toggleWishlist } = useWishlist()
  // The tapped card's data first (if any); undefined while loading, null when missing.
  const [offer, setOffer] = useState<OfferDocument | null | undefined>(() => (offerId ? cachedOffer(offerId) : undefined))
  const [claimed, setClaimed] = useState<boolean | null>(null)
  // Read once per mount, since render must stay pure.
  const [now] = useState(Date.now)

  useEffect(() => {
    if (!offerId) return
    let cancelled = false
    getOffer(offerId)
      .then((next) => {
        if (!cancelled) setOffer(next)
      })
      .catch(() => {
        // Keep the card's data if there is any; otherwise show "not found".
        if (!cancelled) setOffer((current) => current ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [offerId])

  const uid = user?.uid
  // A failed read leaves Buy available; checkout itself refuses a second claim.
  const fetchClaimed = useCallback(
    () => (uid && offerId ? hasUserClaimedOffer(uid, offerId).catch(() => false) : Promise.resolve(false)),
    [uid, offerId]
  )

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      fetchClaimed().then((next) => {
        if (!cancelled) setClaimed(next)
      })
      return () => {
        cancelled = true
      }
    }, [fetchClaimed])
  )

  const buy = () => {
    if (offer) router.push({ pathname: '/checkout/[offerId]', params: { offerId: offer.id } })
  }

  const discount = offer ? getOfferDiscountPercent(offer.originalPrice, offer.offerPrice) : 0
  const tile = offer ? CATEGORY_TILES.find((c) => c.category === offer.category) : undefined
  const saved = offer ? isWishlisted(offer.id) : false
  const remaining = offer && offer.totalQuantity !== null ? Math.max(offer.totalQuantity - offer.claimedCount, 0) : null
  const expired = !!offer?.expiryDate && offer.expiryDate.getTime() < now

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={offer?.businessName ?? ''} fallback="/perks" />
      {offer === undefined ? (
        <ActivityIndicator color={colors.brand} style={styles.spinner} />
      ) : offer === null ? (
        <View style={styles.notFound}>
          <AppText style={styles.notFoundTitle}>{t('offer_detail_not_found_title')}</AppText>
          <AppText style={styles.notFoundSub}>{t('offer_detail_not_found_sub')}</AppText>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
            <View style={styles.card}>
              <View style={styles.hero}>
                <PerkImage uri={offer.imageUrl} category={offer.category} businessName={offer.businessName} />
                {discount > 0 && (
                  <View style={styles.discount}>
                    <AppText style={styles.discountText}>{t('offer_percent_off').replace('{n}', String(discount))}</AppText>
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={saved ? t('btn_remove_from_wishlist') : t('btn_add_to_wishlist')}
                  accessibilityState={{ selected: saved }}
                  onPress={() => toggleWishlist(offer.id)}
                  style={({ pressed }) => [styles.heart, saved && styles.heartSaved, pressed && styles.heartPressed]}
                >
                  <LineIcon name="heart" size={20} color={saved ? colors.white : colors.textMuted} fill={saved ? colors.white : 'none'} strokeWidth={2.2} />
                </Pressable>
              </View>

              <View style={styles.body}>
                <View style={styles.chips}>
                  <View style={styles.categoryChip}>
                    <AppText style={styles.categoryText} numberOfLines={1}>
                      {tile ? `${tile.emoji} ${t(tile.labelKey)}` : offer.category}
                    </AppText>
                  </View>
                  <View style={styles.methodChip}>
                    <LineIcon name={REDEMPTION_METHOD_ICONS[offer.redemptionMethod]} size={13} color={colors.brand} strokeWidth={2.2} />
                    <AppText style={styles.methodText}>{t(REDEMPTION_METHOD_LABEL_KEYS[offer.redemptionMethod])}</AppText>
                  </View>
                </View>

                <AppText style={styles.business}>{offer.businessName}</AppText>
                <AppText style={styles.title} accessibilityRole="header">{offer.title}</AppText>
                {!!offer.location && (
                  <View style={styles.location}>
                    <LineIcon name="pin" size={14} color={colors.textFaint} strokeWidth={2} />
                    <AppText style={styles.locationText}>{offer.location}</AppText>
                  </View>
                )}

                <View style={styles.priceRow}>
                  <AppText ltr style={styles.price}>{formatPrice(offer.offerPrice)}</AppText>
                  {discount > 0 && <AppText ltr style={styles.original}>{formatPrice(offer.originalPrice)}</AppText>}
                </View>

                {!!offer.description && <AppText style={styles.description}>{offer.description}</AppText>}

                {(offer.expiryDate || remaining !== null) && (
                  <View style={styles.facts}>
                    {offer.expiryDate && (
                      <View style={styles.fact}>
                        <LineIcon name="calendar" size={14} color={colors.textFaint} strokeWidth={2} />
                        <AppText style={[styles.factText, expired && styles.expired]}>
                          {t('offer_detail_expires').replace('{date}', formatLongDate(offer.expiryDate, lang))}
                        </AppText>
                      </View>
                    )}
                    {remaining !== null && (
                      <View style={styles.fact}>
                        <LineIcon name="tag" size={14} color={colors.textFaint} strokeWidth={2} />
                        <AppText style={styles.factText}>{t('offer_detail_remaining').replace('{count}', String(remaining))}</AppText>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.divider} />
                <AppText style={styles.howTitle} accessibilityRole="header">{t('redeem_how_title')}</AppText>
                {redemptionSteps(offer.redemptionMethod, offer.redemptionInstructions, t).map((step, i) => (
                  <View key={i} style={styles.step} accessibilityLabel={`${i + 1}. ${step}`} accessible>
                    <View style={styles.stepNumber}>
                      <AppText ltr style={styles.stepNumberText}>{i + 1}</AppText>
                    </View>
                    <AppText style={styles.stepText}>{step}</AppText>
                  </View>
                ))}
                {!!offer.redemptionTerms && (
                  <>
                    <AppText style={styles.termsLabel} accessibilityRole="header">{t('voucher_redemption_terms_label')}</AppText>
                    <AppText style={styles.terms}>{offer.redemptionTerms}</AppText>
                  </>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Pinned above the home indicator, outside the scroll. */}
          <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {claimed ? (
              <View style={styles.claimed} accessibilityLiveRegion="polite">
                <LineIcon name="check" size={20} color={colors.success} strokeWidth={2.5} />
                <AppText style={styles.claimedTitle}>{t('offer_already_claimed_title')}</AppText>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.navigate('/wallet')}
                  hitSlop={8}
                  style={styles.claimedLink}
                >
                  <AppText style={styles.claimedLinkText}>{t('home_pass_cta')}</AppText>
                </Pressable>
              </View>
            ) : (
              <Button
                label={t('offer_buy_button').replace('{price}', formatPrice(offer.offerPrice))}
                onPress={buy}
                busy={claimed === null}
                disabled={expired}
                large
              />
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  spinner: { marginTop: 48 },
  notFound: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24 },
  notFoundTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 4 },
  notFoundSub: { fontSize: 14, color: colors.body, textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  card: { backgroundColor: colors.white, borderRadius: 24, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  hero: { aspectRatio: 16 / 10, backgroundColor: colors.brandTint },
  // Web: components/discover/DiscountBadge.tsx (solid emerald-700, white text).
  discount: { position: 'absolute', bottom: 12, start: 12, backgroundColor: '#047857', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  discountText: { fontSize: 13, fontWeight: '800', color: colors.white, letterSpacing: 0.5, textTransform: 'uppercase' },
  heart: {
    position: 'absolute',
    top: 12,
    end: 12,
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    ...webOnly({ cursor: 'pointer' }),
  },
  heartSaved: { backgroundColor: '#ef4444' },
  heartPressed: { transform: [{ scale: 0.92 }] },
  body: { padding: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { backgroundColor: '#eff6ff', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '100%' },
  categoryText: { fontSize: 12, fontWeight: '600', color: '#1d4ed8' },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.borderLight,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  methodText: { fontSize: 12, fontWeight: '600', color: colors.body },
  business: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: colors.heading, marginTop: 16 },
  title: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: colors.text, marginTop: 6 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  locationText: { flex: 1, fontSize: 14, color: colors.textFaint },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  price: { fontSize: 28, fontWeight: '800', color: colors.brand },
  original: { fontSize: 17, color: colors.textFaint, textDecorationLine: 'line-through' },
  description: { fontSize: 15, lineHeight: 23, color: colors.body, marginTop: 16 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 8, marginTop: 16 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  factText: { fontSize: 13, fontWeight: '500', color: colors.body },
  expired: { color: colors.danger },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 20 },
  howTitle: { fontSize: 14, fontWeight: '700', color: colors.heading, marginBottom: 12 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stepNumber: { width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumberText: { fontSize: 11, fontWeight: '700', color: colors.white, textAlign: 'center' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.body },
  termsLabel: { fontSize: 12, fontWeight: '700', color: colors.textStrong, marginTop: 12, marginBottom: 4 },
  terms: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
  actionBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  claimed: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, minHeight: 52 },
  claimedTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.heading },
  claimedLink: { minHeight: 44, justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  claimedLinkText: { fontSize: 15, fontWeight: '700', color: colors.brand },
})
