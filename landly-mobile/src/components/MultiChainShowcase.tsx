import { useMemo, useRef, useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedScrollHandler, useReducedMotion, useSharedValue } from 'react-native-reanimated'
import type { OfferDocument } from '@shared/firebase/offers'
import { isolateLtr, showcaseCards, type ShowcaseCard } from '@shared/home/superShowcase'
import { useLang } from '../i18n/LangProvider'
import { colors, radius } from '../theme'
import { openOffer } from '../lib/openOffer'
import AppText from './AppText'
import PagerDots from './PagerDots'
import { CAROUSEL_GAP as GAP, carouselPage, carouselSnapOffsets } from '../lib/carousel'
import { useLayout } from '../lib/useLayout'
import { isWeb, webOnly } from '../lib/webStyles'
import LineIcon from './LineIcon'

// The Perks tab's flagship "Multi-Chain Super Vouchers" showcase (web: components/discover/MultiChainShowcase.tsx): a centred header,
// then one large card per voucher value, stacked on a phone. The top value is the midnight-navy "Best Value" card. Each card opens
// the multi-chain offer with its value already picked. Prices keep left-to-right order inside Hebrew (writingDirection / isolates).
export default function MultiChainShowcase({ offer }: { offer: OfferDocument }) {
  const { t, isRtl } = useLang()
  const { width: screenWidth, paddingLeft, paddingRight } = useLayout()
  // The flagship (highest value) leads and the other peeks, so both are in view at once and one swipe reaches the second.
  const cards = useMemo(() => [...showcaseCards(offer)].reverse(), [offer])
  const list = useRef<FlatList<ShowcaseCard>>(null)
  const [viewport, setViewport] = useState(0)
  const reduced = useReducedMotion()
  const position = useSharedValue(0)
  const cardWidth = Math.min(Math.round(screenWidth * 0.84), 320)
  const interval = cardWidth + GAP
  const contentWidth = paddingLeft + paddingRight + cards.length * cardWidth + Math.max(0, cards.length - 1) * GAP
  const maxOffset = Math.max(0, contentWidth - viewport)
  const snapToOffsets = useMemo(() => (isWeb || !viewport ? undefined : carouselSnapOffsets(cards.length, interval, maxOffset, isRtl)), [cards.length, interval, maxOffset, isRtl, viewport])
  const starts = useMemo(() => (viewport ? carouselSnapOffsets(cards.length, interval, maxOffset, false) : []), [cards.length, interval, maxOffset, viewport])
  const onScroll = useAnimatedScrollHandler((e) => {
    const x = e.contentOffset.x
    position.set(carouselPage(isWeb ? Math.abs(x) : isRtl ? maxOffset - x : x, starts))
  })
  const goTo = (i: number) => {
    const fromStart = starts[i] ?? 0
    list.current?.scrollToOffset({ offset: !isRtl ? fromStart : isWeb ? -fromStart : maxOffset - fromStart, animated: !reduced })
  }
  if (cards.length === 0) return null
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <AppText accessibilityRole="header" style={styles.title}>{t('super_showcase_title')}</AppText>
        <AppText style={styles.subtitle}>{t('super_showcase_sub')}</AppText>
      </View>
      <View style={[styles.frame, { marginLeft: -paddingLeft, marginRight: -paddingRight }]}>
        <Animated.FlatList
          ref={list}
          data={cards}
          keyExtractor={(c) => c.pool}
          horizontal
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          snapToOffsets={snapToOffsets}
          snapToEnd={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={[styles.scroller, webOnly({ scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain', scrollPaddingLeft: paddingLeft, scrollPaddingRight: paddingRight }) as object]}
          contentContainerStyle={{ paddingLeft, paddingRight, paddingTop: 2, paddingBottom: 10 }}
          ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
          onLayout={(e) => setViewport(e.nativeEvent.layout.width)}
          // A horizontal list opens at its left edge even when it lays out right-to-left; jump to the reading-direction start.
          onContentSizeChange={() => { if (isRtl) list.current?.scrollToEnd({ animated: false }) }}
          renderItem={({ item }) => (
            <View style={[{ width: cardWidth }, webOnly({ scrollSnapAlign: 'start' }) as object]}>
              <VoucherCard card={item} offer={offer} />
            </View>
          )}
        />
        {cards.length > 1 && starts.length > 1 && <PagerDots count={starts.length} position={position} onSelect={goTo} />}
      </View>
    </View>
  )
}

function VoucherCard({ card, offer }: { card: ShowcaseCard; offer: OfferDocument }) {
  const { t, isRtl } = useLang()
  const dark = card.best
  const value = isolateLtr(`₪${card.value}`)
  const cta = t('super_card_cta').replace('{value}', value)
  const eyebrow = t('super_card_title')
  const ink = dark ? colors.white : colors.heading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('super_card_title')} ${value}: ${isolateLtr(`₪${card.price}`)}`}
      onPress={() => openOffer(offer, card.denomination)}
      style={({ pressed }) => [styles.card, dark ? styles.cardDark : styles.cardLight, pressed && styles.pressed]}
    >
      {/* The discount hangs across the top trailing corner as a diagonal ribbon (the card clips it): 45deg at the right, -45deg at the left in Hebrew. */}
      <View pointerEvents="none" accessible={false} style={[styles.ribbon, { transform: [{ rotate: isRtl ? '-45deg' : '45deg' }] }]}>
        <AppText ltr style={styles.ribbonText}>{`-${card.discountPercent}%`}</AppText>
      </View>
      <AppText numberOfLines={1} style={[styles.kicker, dark && styles.clearRibbon, { color: dark ? '#FCD34D' : '#64748B', fontWeight: dark ? '700' : '600' }]}>{isRtl ? eyebrow : eyebrow.toUpperCase()}</AppText>
      <AppText numberOfLines={1} style={[styles.value, dark && styles.clearRibbon, { color: ink }]}>{t('super_card_value_line').replace('{value}', value)}</AppText>
      <View style={styles.priceRow}>
        <AppText ltr style={[styles.price, { color: ink }]}>{`₪${card.price}`}</AppText>
        <AppText ltr style={[styles.was, { color: dark ? 'rgba(255,255,255,0.5)' : '#94A3B8' }]}>{`₪${card.value}`}</AppText>
      </View>
      <View style={[styles.cta, { backgroundColor: dark ? colors.white : colors.brand }]}>
        <AppText numberOfLines={1} style={[styles.ctaText, { color: dark ? '#0B1B3D' : colors.white }]}>{cta}</AppText>
        <LineIcon name="arrowUpEnd" size={16} color={dark ? '#0B1B3D' : colors.white} strokeWidth={2} flip={isRtl} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: 28, marginBottom: 14 },
  frame: {},
  scroller: { flexGrow: 0 },
  header: { alignItems: 'center', marginBottom: 14, paddingHorizontal: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.heading, textAlign: 'center', letterSpacing: -0.3 },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 19, color: colors.body, textAlign: 'center' },
  card: { flex: 1, minHeight: 208, justifyContent: 'space-between', borderRadius: 24, borderCurve: 'continuous', padding: 16, overflow: 'hidden' },
  cardLight: { backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)', shadowColor: '#0B1B3D', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardDark: { backgroundColor: '#102654', borderWidth: 2, borderColor: 'rgba(0,56,184,0.3)', experimental_backgroundImage: 'linear-gradient(135deg, #0B1B3D, #102654 50%, #0B1B3D)', shadowColor: '#0B1B3D', shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  kicker: { fontSize: 12, letterSpacing: 0.5 },
  value: { marginTop: 4, fontSize: 20, fontWeight: '700' },
  // The ribbon: emerald, 132pt wide, centred on the card's top trailing corner diagonal.
  ribbon: { position: 'absolute', top: 22, end: -34, width: 132, paddingVertical: 4, alignItems: 'center', backgroundColor: '#059669', zIndex: 2, shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  ribbonText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.white, fontVariant: ['tabular-nums'] },
  clearRibbon: { paddingEnd: 80 },
  priceRow: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  price: { fontSize: 30, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  was: { fontSize: 14, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
  cta: { marginTop: 18, minHeight: 44, borderRadius: radius.action + 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  ctaText: { flexShrink: 1, fontSize: 14, fontWeight: '700' },
})
