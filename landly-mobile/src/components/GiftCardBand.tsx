import { Pressable, StyleSheet, View } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import { isolateLtr } from '@shared/home/superShowcase'
import { roundedCount } from '@shared/offers/raayonitPreview'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { ClubCard } from './RaayonitHero'
import RaayonitPromoStrip from './RaayonitPromoStrip'
import { useLang } from '../i18n/LangProvider'
import { useFlagshipPurchase } from '../lib/useFlagshipPurchase'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// "Gift cards" on Home and Explore Perks (web: components/home/GiftCardBand.tsx). Home gets the full band: the club card on a soft tinted
// surface, the "Valid at 230+ chains" label, the two values as one line each and one action to the hub. Perks gets the compact strip.
// The redemption and hotel terms live on the hub and the offer screen, not here.
export default function GiftCardBand({ offer, count, compact = false }: { offer: OfferDocument | null; count: number; compact?: boolean }) {
  if (compact) return <RaayonitPromoStrip offer={offer} count={count} />
  return <FullBand offer={offer} count={count} />
}

function FullBand({ offer, count }: { offer: OfferDocument | null; count: number }) {
  const { t, isRtl } = useLang()
  const purchase = useFlagshipPurchase(offer)
  const { cards, selectedPool, ownedPools, block } = purchase
  const open = purchase.openHub
  // Selecting a value and the Buy action go straight to checkout; the club card and the details link open the hub. With no live offer
  // yet, the tiles are a preview and the action opens the hub.
  const disabled = purchase.ready && !!block
  const label = block ? t(block === 'owned' ? 'offer_already_claimed_title' : 'products_unavailable') : t('products_cta')
  return (
    <View style={styles.band}>
      <View style={styles.head}>
        <AppText accessibilityRole="header" style={styles.title}>{t('products_title')}</AppText>
        <AppText style={styles.label}>{t('gift_valid_chains').replace('{count}+', isolateLtr(`${roundedCount(count)}+`))}</AppText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('products_card_name')} onPress={open} style={({ pressed }) => pressed && styles.pressed}>
        <ClubCard />
      </Pressable>
      <View style={styles.values}>
        {cards.map((c) => {
          const worth = t('products_worth').replace('{value}', isolateLtr(`₪${c.value}`))
          const on = c.pool === selectedPool
          const owned = ownedPools.includes(c.pool)
          return (
            <Pressable key={c.pool} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: owned }} accessibilityLabel={`${isolateLtr(`₪${c.price}`)}, ${worth}`} disabled={owned} onPress={() => purchase.select(c.pool)} style={({ pressed }) => [styles.value, on && styles.valueOn, owned && styles.valueOff, pressed && styles.pressed]}>
              <AppText ltr style={styles.price}>{`₪${c.price}`}</AppText>
              <AppText numberOfLines={1} style={styles.worth}>{worth}</AppText>
            </Pressable>
          )
        })}
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={purchase.ready ? purchase.openDetails : open} style={({ pressed }) => [styles.cta, disabled && styles.ctaOff, pressed && styles.pressed]}>
        <AppText numberOfLines={1} style={styles.ctaText}>{label}</AppText>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={open} style={({ pressed }) => [styles.details, pressed && styles.pressed]}>
        <AppText numberOfLines={1} style={styles.detailsText}>{t('products_details_link').replace('{count}+', isolateLtr(`${roundedCount(count)}+`))}</AppText>
        <LineIcon name="chevronEnd" size={16} color={colors.brand} strokeWidth={2} flip={isRtl} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  band: { gap: 14, padding: 14, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: '#DBEAFE', backgroundColor: '#F5F9FF' },
  head: { gap: 2, paddingHorizontal: 2 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, color: colors.heading },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.brand },
  values: { flexDirection: 'row', gap: 10 },
  value: { flex: 1, minHeight: 64, justifyContent: 'center', alignItems: 'center', gap: 2, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', ...webOnly({ cursor: 'pointer' }) },
  valueOn: { borderColor: colors.brand, borderWidth: 2, backgroundColor: '#F0F7FF' },
  valueOff: { opacity: 0.45 },
  ctaOff: { opacity: 0.5 },
  details: { minHeight: 44, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  detailsText: { fontSize: 14, fontWeight: '700', color: colors.brand },
  price: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, color: colors.heading, fontVariant: ['tabular-nums'] },
  worth: { fontSize: 12.5, color: '#64748B' },
  cta: { minHeight: 48, flexDirection: 'row', gap: 4, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, backgroundColor: colors.brand, ...webOnly({ cursor: 'pointer' }) },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  pressed: { opacity: 0.88 },
})
