import { memo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import { localizedBusinessName } from '@shared/business/businessText'
import { isolateLtr } from '@shared/home/superShowcase'
import { REFERRAL_KEYS, referralHeadline, referralSummary, referralTarget } from '@shared/perks/raayonitReferral'
import { roundedCount } from '@shared/offers/raayonitPreview'
import { RAAYONIT_HUB } from '@shared/offers/offerRoutes'
import { useRouter } from 'expo-router'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { openOffer } from '../lib/openOffer'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

const FSI = '⁨'
const PDI = '⁩'

// A search with no GoLandly perk that names a business honouring the Raayonit Card (web: components/perks/RaayonitReferralCard.tsx): one compact
// white card, a line badge, the venue's name, one sentence on the card and "View card". One match opens that venue; several open the hub
// with the search filled in. `chainCount` is the live number of chains (rounded down to a whole ten, as everywhere else).
export default memo(function RaayonitReferralCard({ matches, query, chainCount }: { matches: OfferDocument[]; query: string; chainCount: number }) {
  const { t, lang, isRtl } = useLang()
  const router = useRouter()
  const summary = referralSummary(matches, (o) => localizedBusinessName(o, lang).text)
  const target = referralTarget(matches, query)
  if (!summary || !target) return null
  const { before, after } = referralHeadline(t(summary.others > 0 ? REFERRAL_KEYS.more : REFERRAL_KEYS.one), summary.others)
  const title = `${before}${FSI}${summary.venue}${PDI}${after}`
  const open = () => (target.kind === 'offer' ? openOffer(target.offer) : router.push({ pathname: RAAYONIT_HUB, params: { q: target.query } }))
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${title}. ${t(REFERRAL_KEYS.cta)}`} onPress={open} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.badge} accessible={false} importantForAccessibility="no-hide-descendants">
        <LineIcon name="arrowUpEnd" size={20} color={colors.brand} strokeWidth={1.75} flip={isRtl} />
      </View>
      <View style={styles.copy}>
        <AppText style={styles.title}>{title}</AppText>
        <AppText style={styles.sub}>{t(REFERRAL_KEYS.sub).replace('{count}+', isolateLtr(`${roundedCount(chainCount)}+`))}</AppText>
        <View style={styles.cta}>
          <AppText style={styles.ctaText}>{t(REFERRAL_KEYS.cta)}</AppText>
          <LineIcon name="chevronEnd" size={14} color={colors.brand} strokeWidth={2} flip={isRtl} />
        </View>
      </View>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 44, padding: 14, marginTop: 8, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', ...webOnly({ cursor: 'pointer' }) },
  pressed: { opacity: 0.75 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.brandLight, flexShrink: 0 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, lineHeight: 21, fontWeight: '700', letterSpacing: -0.2, color: colors.heading },
  sub: { fontSize: 13, lineHeight: 18, color: colors.body },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6 },
  ctaText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.brand },
})
