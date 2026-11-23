import { memo } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import type { OfferDocument } from '@shared/firebase/offers'
import { liveChainCount } from '@shared/home/chainsPreview'
import { isolateLtr } from '@shared/home/superShowcase'
import { RAAYONIT_HUB } from '@shared/offers/offerRoutes'
import AppText from './AppText'
import Button from './Button'
import RaayonitBanner from './RaayonitBanner'
import LineIcon from './LineIcon'
import LiveChainTile, { LIVE_TILE_WIDTH } from './LiveChainTile'
import { useLang } from '../i18n/LangProvider'
import { useLayout } from '../lib/useLayout'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// "Redeemable today at {count}+ chains and businesses" on Home and Explore Perks while GoLandly has no direct perks of its own (web:
// components/perks/LiveChainsSection.tsx): the live count, one line, a primary action to the Raayonit Card tab and a sideways row of
// participating chains ending in "See all chains". `chainCount` is the real number of chains: the heading shows no number until it is known,
// and the section is absent without chains. It only reads the tab's data; nothing of the tab is restyled.
export default memo(function LiveChainsSection({ offers, chainCount, card = false }: { offers: OfferDocument[]; chainCount: number; card?: boolean }) {
  const { t, isRtl } = useLang()
  const router = useRouter()
  const { paddingLeft, paddingRight } = useLayout()
  const count = liveChainCount(chainCount)
  if (count === null || offers.length === 0) return null
  const open = () => router.push(RAAYONIT_HUB)
  return (
    <View style={styles.section}>
      <AppText accessibilityRole="header" style={styles.title}>{t('chains_live_title').replace('{count}', isolateLtr(`${count}+`))}</AppText>
      <AppText style={styles.sub}>{t('chains_live_sub')}</AppText>
      {card ? <RaayonitBanner /> : <View style={styles.cta}><Button label={t('chains_live_cta')} onPress={open} arrow /></View>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} style={{ marginLeft: -paddingLeft, marginRight: -paddingRight }} contentContainerStyle={[styles.row, { paddingLeft, paddingRight }]}>
        {offers.map((o) => <LiveChainTile key={o.id} offer={o} />)}
        <Pressable accessibilityRole="link" accessibilityLabel={t('chains_live_show_all')} onPress={open} style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
          <AppText numberOfLines={2} style={styles.moreText}>{t('chains_live_show_all')}</AppText>
          <LineIcon name="chevronEnd" size={16} color={colors.brand} strokeWidth={2} flip={isRtl} />
        </Pressable>
      </ScrollView>
    </View>
  )
})

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4, color: colors.heading },
  sub: { marginTop: 4, fontSize: 14, lineHeight: 20, color: colors.body },
  cta: { marginTop: 14 },
  row: { gap: 10, paddingTop: 16, paddingBottom: 8 },
  pressed: { opacity: 0.75 },
  more: { width: 120, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 10, minHeight: LIVE_TILE_WIDTH * 0.75, ...webOnly({ cursor: 'pointer' }) },
  moreText: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: colors.brand, textAlign: 'center' },
})
