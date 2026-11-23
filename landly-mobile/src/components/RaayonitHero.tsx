import { useState } from 'react'
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native'
import Svg, { Defs, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg'
import { useRouter } from 'expo-router'
import { ARCH, ARROW, EMBLEM_VIEWBOX, STAR } from '@shared/brand/emblemPaths'
import { useRaayonitDisplay } from '@shared/flags/raayonitDisplayStore'
import type { OfferDocument } from '@shared/firebase/offers'
import { isolateLtr, type ShowcaseCard } from '@shared/home/superShowcase'
import { flagshipLimitNotice } from '@shared/offers/flagshipLimit'
import AppText from './AppText'
import ComingSoonNotice from './ComingSoonNotice'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { useFlagshipPurchase } from '../lib/useFlagshipPurchase'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MARK = require('../../assets/images/raayonit-logo.png') as ImageSourcePropType

// The flagship product of "Our Products" (web: components/raayonit/RaayonitHero.tsx): a royal-blue club card (GoLandly × Raayonit Card,
// "Issued by Raayonit Ltd."), three equal-height denomination tiles read from the live offer (89 / 132 / 174, the 200 value pre-selected as "Best value", when none are configured),
// a one-line validity note, the primary "Details & Purchase" action and one collapsed row for the full redemption and hotel rules.
export default function RaayonitHero({ offer, buy = false, step = 'hub' }: { offer: OfferDocument | null; buy?: boolean; /** 'hub': the action opens the details page. 'details': it continues to checkout and the rules fold is left out (the screen shows them). */ step?: 'hub' | 'details' }) {
  const { t } = useLang()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const purchase = useFlagshipPurchase(offer)
  const { cards, card, selectedPool, ownedPools, block } = purchase
  const limit = buy && step === 'details' ? flagshipLimitNotice(cards, ownedPools) : null
  // On the hub (`buy`) a tile selects its value and the action goes straight to checkout; elsewhere the whole card opens the hub.
  const disabled = buy && (!purchase.ready || !!block)
  const label = buy ? (block ? t(block === 'owned' ? 'offer_already_claimed_title' : block === 'comingSoon' ? 'raayonit_coming_soon_cta' : 'products_unavailable') : step === 'details' ? t('raayonit_continue_order').replace('{price}', isolateLtr(`₪${card?.price ?? ''}`)) : t('products_cta')) : t('products_cta')
  return (
    <View style={styles.card}>
      <ClubCard />
      {step === 'details' && <AppText accessibilityRole="header" style={styles.chooseTitle}>{t('raayonit_choose_value')}</AppText>}
      <View style={styles.values}>
        {cards.map((c) => (
          <ValueCard key={c.pool} card={c} selectable={buy && step === 'details'} selected={buy && step === 'details' && c.pool === selectedPool} owned={buy && step === 'details' && ownedPools.includes(c.pool)} onPress={() => (buy ? purchase.select(c.pool) : router.push('/raayonit'))} />
        ))}
      </View>
      {limit && (
        <View accessibilityRole="alert" style={styles.limit}>
          <View style={styles.limitIcon}><LineIcon name="help" size={18} color="#B45309" strokeWidth={1.75} /></View>
          <AppText style={styles.limitText}>{t(limit.kind === 'all' ? 'raayonit_limit_all' : 'raayonit_limit_some').replace('{values}', limit.values)}</AppText>
        </View>
      )}
      {block === 'comingSoon' && <ComingSoonNotice style={styles.notice} />}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={() => (buy ? (step === 'details' ? purchase.buy() : purchase.openDetails()) : router.push('/raayonit'))} style={({ pressed }) => [styles.cta, disabled && styles.ctaOff, pressed && styles.pressed]}>
        <AppText numberOfLines={1} style={styles.ctaText}>{label}</AppText>
      </Pressable>
      {step === 'hub' && <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.rulesRow}>
        <AppText numberOfLines={2} style={styles.rulesTitle}>{t('raayonit_rules_title')}</AppText>
        <LineIcon name="chevronDown" size={18} color={colors.brand} strokeWidth={2} style={open ? styles.open : undefined} />
      </Pressable>}
      {step === 'hub' && open && (
        <View style={styles.rules}>
          <AppText style={styles.ruleText}>{t('raayonit_flagship_desc')}</AppText>
          <AppText style={styles.ruleText}>{t('raayonit_hotel_notice')}</AppText>
        </View>
      )}
    </View>
  )
}

// The club card graphic, a co-branded gift card laid out left to right like a physical one: the GoLandly emblem and wordmark with the
// Raayonit logo in a white badge on top, the product name in the middle, and the issuer line under a hairline at the bottom.
const VB = `0 0 ${EMBLEM_VIEWBOX.width} ${EMBLEM_VIEWBOX.height}`
export function WhiteEmblem({ height }: { height: number }) {
  return (
    <Svg viewBox={VB} width={Math.round((height * EMBLEM_VIEWBOX.width) / EMBLEM_VIEWBOX.height)} height={height}>
      {[STAR, ARCH, ARROW].map((part, i) => (
        <G key={i}>
          <Path d={part.light} fill="#FFFFFF" fillRule="evenodd" />
          <Path d={part.dark} fill="rgba(255,255,255,0.72)" fillRule="evenodd" />
        </G>
      ))}
    </Svg>
  )
}

export function ClubCard() {
  const { t } = useLang()
  const display = useRaayonitDisplay()
  return (
    <View style={styles.club} accessible accessibilityRole="image" accessibilityLabel={`GoLandly, ${t('products_card_name')}, ${t('products_issued_line')}`}>
      {/* The background and the sheen are one SVG (no rotated view under the rounded clip, which iOS sized short of the card). */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="clubGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#1D4ED8" />
            <Stop offset="1" stopColor="#0B2A8F" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#clubGrad)" />
        <Polygon points="66,0 86,0 70,100 50,100" fill="#FFFFFF" fillOpacity={0.07} />
      </Svg>
      <View pointerEvents="none" style={[styles.accent, { top: 88 }]} />
      <View style={styles.clubContent}>
        <View style={styles.clubTop}>
          <View style={styles.clubBrandRow}>
            <WhiteEmblem height={34} />
            <AppText ltr style={styles.clubBrand}>GoLandly</AppText>
          </View>
          {display && (
            <View style={styles.clubBadge}><Image source={MARK} style={styles.clubBadgeLogo} resizeMode="contain" accessible={false} /></View>
          )}
        </View>
        <View style={styles.clubMid}>
          <AppText ltr numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.clubTitle}>{t('products_card_name')}</AppText>
          <AppText numberOfLines={2} style={styles.clubTag}>{t('products_card_tagline')}</AppText>
        </View>
        <View style={styles.clubBottom}>
          <View style={styles.clubRule} />
          <AppText numberOfLines={2} style={styles.clubIssuer}>{t('products_issued_line')}</AppText>
        </View>
      </View>
    </View>
  )
}

function ValueCard({ card, selectable, selected, owned, onPress }: { card: ShowcaseCard; selectable: boolean; selected: boolean; owned: boolean; onPress: () => void }) {
  const { t, isRtl } = useLang()
  const worth = t('products_worth').replace('{value}', isolateLtr(`₪${card.value}`))
  // A price card: the discount on a green ribbon across the start corner, the price, what the card is worth and what you save. On the hub the tiles only
  // show the ladder (the best value is emphasised); on the details screen they are the value choice.
  const emphasis = selected || (!selectable && card.best)
  const body = (
    <>
      <View pointerEvents="none" style={[styles.ribbon, isRtl ? styles.ribbonEnd : styles.ribbonStart]}>
        <AppText ltr style={styles.ribbonText}>{`-${card.discountPercent}%`}</AppText>
      </View>
      <AppText ltr style={styles.price}>{`₪${card.price}`}</AppText>
      <AppText numberOfLines={1} style={styles.worth}>{worth}</AppText>
      {card.save > 0 && <View style={styles.savePill}><AppText numberOfLines={1} style={styles.saveText}>{t('super_card_save').replace('{amount}', isolateLtr(`₪${card.save}`))}</AppText></View>}
      {selected && <View pointerEvents="none" style={[styles.check, isRtl ? styles.checkEnd : styles.checkStart]}><LineIcon name="check" size={14} color="#FFFFFF" strokeWidth={3} /></View>}
      {card.best && <View style={styles.bestStrip}><AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.bestText}>{t('raayonit_best_value').replace('{percent}', isolateLtr(`${card.discountPercent}%`))}</AppText></View>}
    </>
  )
  if (!selectable) return <View style={[styles.value, emphasis && styles.valueOn]}>{body}</View>
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: owned }}
      accessibilityLabel={`${isolateLtr(`₪${card.price}`)}, ${worth}`}
      disabled={owned}
      onPress={onPress}
      style={({ pressed }) => [styles.value, emphasis && styles.valueOn, owned && styles.valueOff, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { gap: 16, padding: 16, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)', backgroundColor: '#FFFFFF', shadowColor: '#0B1B3D', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  club: { alignSelf: 'stretch', minHeight: 250, borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' },
  clubContent: { flex: 1, minHeight: 250, paddingHorizontal: 20, paddingVertical: 18, justifyContent: 'space-between', direction: 'ltr' },
  accent: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.22)' },
  clubTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 },
  clubBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
  clubBrand: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, color: '#FFFFFF' },
  clubBadge: { height: 52, paddingHorizontal: 10, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  clubBadgeLogo: { width: 28, height: 44 },
  clubMid: { gap: 2, minWidth: 0, maxWidth: '100%' },
  clubTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -0.7, color: '#FFFFFF' },
  clubTag: { flexShrink: 1, fontSize: 14, color: 'rgba(255,255,255,0.82)', writingDirection: 'auto', textAlign: 'left' },
  clubBottom: { minWidth: 0, maxWidth: '100%' },
  clubRule: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.35)', marginBottom: 8 },
  clubIssuer: { flexShrink: 1, fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.85)', writingDirection: 'auto', textAlign: 'left' },
  values: { flexDirection: 'row', gap: 8, alignItems: 'stretch', marginTop: 2 },
  value: { flex: 1, minWidth: 0, minHeight: 148, justifyContent: 'center', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingTop: 36, paddingBottom: 18, borderRadius: 18, borderCurve: 'continuous', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)', backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1, ...webOnly({ cursor: 'pointer' }) },
  valueOn: { borderColor: colors.brand, borderWidth: 2, backgroundColor: '#F0F7FF' },
  check: { position: 'absolute', top: 8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  checkStart: { right: 8 },
  checkEnd: { left: 8 },
  limit: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 14, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(253,230,138,0.9)', backgroundColor: '#FFFBEB' },
  limitIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(253,230,138,0.9)', backgroundColor: '#FEF3C7' },
  notice: { marginTop: 16 },
  limitText: { flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 20, fontWeight: '600', color: '#451A03' },
  chooseTitle: { marginBottom: 12, fontSize: 19, fontWeight: '800', letterSpacing: -0.3, color: colors.heading },
  ribbon: { position: 'absolute', top: 14, width: 112, paddingVertical: 3, alignItems: 'center', backgroundColor: '#16A34A' },
  ribbonStart: { left: -36, transform: [{ rotate: '-45deg' }] },
  ribbonEnd: { right: -36, transform: [{ rotate: '45deg' }] },
  ribbonText: { fontSize: 11, lineHeight: 16, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  savePill: { marginTop: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#F0FDF4' },
  valueOff: { opacity: 0.45 },
  ctaOff: { opacity: 0.5 },
  bestStrip: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 2, paddingHorizontal: 2, alignItems: 'center', backgroundColor: colors.brand },
  bestText: { fontSize: 9.5, lineHeight: 12, fontWeight: '700', color: '#FFFFFF' },
  price: { fontSize: 27, fontWeight: '800', letterSpacing: -0.8, color: colors.heading, fontVariant: ['tabular-nums'] },
  saveText: { fontSize: 12, fontWeight: '600', color: '#15803D', fontVariant: ['tabular-nums'] },
  worth: { fontSize: 12, color: '#64748B' },
  cta: { minHeight: 48, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, backgroundColor: colors.brand, ...webOnly({ cursor: 'pointer' }) },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  pressed: { opacity: 0.88 },
  rulesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#F0F7FF', ...webOnly({ cursor: 'pointer' }) },
  rulesTitle: { flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.brand },
  open: { transform: [{ rotate: '180deg' }] },
  rules: { gap: 10, paddingHorizontal: 4 },
  ruleText: { fontSize: 13, lineHeight: 20, color: colors.body },
})
