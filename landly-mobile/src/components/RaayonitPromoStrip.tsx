import { Image, Pressable, StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { useRouter } from 'expo-router'
import { useRaayonitDisplay } from '@shared/flags/raayonitDisplayStore'
import type { OfferDocument } from '@shared/firebase/offers'
import { bannerFigures, isolateLtr } from '@shared/home/superShowcase'
import { RAAYONIT_HUB } from '@shared/offers/offerRoutes'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { WhiteEmblem } from './RaayonitHero'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MARK = require('../../assets/images/raayonit-logo.png') as ImageSourcePropType

// The slim Raayonit Card entry banner on top of Home (web: components/raayonit/RaayonitPromoStrip.tsx): a mini club-card thumbnail, the
// product name with a one-line "up to {percent}% off at {count}+ chains" note (both read live: the flagship's best discount and the chain
// count, 14 and 230 until known), and a link to the Raayonit Card tab, where the purchase lives. The partner's badge on the thumbnail follows the display flag.
export default function RaayonitPromoStrip({ offer, count }: { offer: OfferDocument | null; count: number }) {
  const { t, isRtl } = useLang()
  const router = useRouter()
  const display = useRaayonitDisplay()
  const { width } = useWindowDimensions()
  const figures = bannerFigures(offer, count)
  const sub = t('raayonit_banner_sub').replace('{percent}', isolateLtr(`${figures.percent}%`)).replace('{count}', isolateLtr(`${figures.count}+`))
  const cta = t('raayonit_banner_cta')
  const showCta = width >= 520
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${t('products_card_name')}. ${sub}. ${cta}`}
      onPress={() => router.push(RAAYONIT_HUB)}
      style={({ pressed }) => [styles.strip, pressed && styles.pressed]}
    >
      <View style={styles.thumb} accessible={false} importantForAccessibility="no-hide-descendants">
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="promoGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#1D4ED8" />
              <Stop offset="1" stopColor="#0B2A8F" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#promoGrad)" />
        </Svg>
        <View style={styles.thumbRow}>
          <WhiteEmblem height={18} />
          {display && <View style={styles.badge}><Image source={MARK} style={styles.badgeLogo} resizeMode="contain" accessible={false} /></View>}
        </View>
      </View>
      <View style={styles.copy}>
        <AppText ltr numberOfLines={1} style={styles.title}>{t('products_card_name')}</AppText>
        <AppText numberOfLines={2} style={styles.sub}>{sub}</AppText>
      </View>
      <View style={styles.link}>
        {showCta && <AppText numberOfLines={1} style={styles.cta}>{cta}</AppText>}
        <LineIcon name="chevronEnd" size={18} color={colors.brand} strokeWidth={2} flip={isRtl} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  strip: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#F5F9FF',
    ...webOnly({ cursor: 'pointer' }),
  },
  thumb: { width: 64, height: 44, borderRadius: 9, borderCurve: 'continuous', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  thumbRow: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', gap: 4 },
  badge: { height: 22, paddingHorizontal: 3, borderRadius: 5, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  badgeLogo: { width: 12, height: 18 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '800', letterSpacing: -0.2, color: colors.heading },
  sub: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  link: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 2 },
  cta: { fontSize: 14, fontWeight: '700', color: colors.brand },
  pressed: { opacity: 0.85 },
})
