import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import { locationNotice, withCount } from '@shared/offers/locationVisibility'
import { participatingBranches } from '@shared/offers/participatingBranches'
import AppText from './AppText'
import BranchNavigationSheet, { type BranchTarget } from './BranchNavigationSheet'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

type ReachOffer = Pick<OfferDocument, 'fulfillmentType' | 'perkScope' | 'isNationwide' | 'participatingChains' | 'participatingPlaces' | 'chainsCount' | 'universalRedemptionGuide' | 'translations'> & { businessName?: string; brandName?: string }

export const isMultiChain = (offer: Pick<ReachOffer, 'perkScope'>) => offer.perkScope === 'multi_chain'

/** Where a multi-branch perk works, in place of a store's address: the store or chain count, or the validity notice. Null for a single-location perk. Wraps instead of cutting mid-sentence. */
export function PerkReachLine({ offer, compact = false }: { offer: ReachOffer; compact?: boolean }) {
  const { t } = useLang()
  const notice = locationNotice(offer)
  if (!notice) return null
  return (
    <View style={styles.line}>
      <View style={styles.icon}>
        <LineIcon name={notice.key === 'perk_honoured_at_chains' ? 'ticket' : 'globe'} size={12} color={colors.brand} strokeWidth={1.75} />
      </View>
      <AppText style={[styles.text, compact && styles.textCompact]} numberOfLines={2}>{withCount(t(notice.key), notice.count)}</AppText>
    </View>
  )
}

/** The stores or chains that honour a perk, as a row of plain cards the reader scrolls sideways, in their own language. */
export function ParticipatingChains({ offer, guide = true }: { offer: ReachOffer; guide?: boolean }) {
  const { t, lang, isRtl } = useLang()
  const branches = participatingBranches(offer, lang)
  const rail = useRef<ScrollView>(null)
  const [picked, setPicked] = useState<BranchTarget | null>(null)
  // One brand's stores are searched with its name in front; a multi-chain pass spans brands, so its names stand alone.
  const brand = offer.perkScope === 'multi_chain' ? null : offer.brandName || offer.businessName || null
  return (
    <View style={styles.chains}>
      <ScrollView
        ref={rail}
        horizontal
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        accessibilityLabel={t(offer.perkScope === 'multi_chain' ? 'perk_chains_title' : 'perk_stores_title')}
        contentContainerStyle={styles.rail}
        // Rows lay out right-to-left in Hebrew, but a horizontal scroller still opens at its left edge; jump to the reading-direction start.
        onContentSizeChange={() => {
          if (isRtl) rail.current?.scrollToEnd({ animated: false })
        }}
      >
        {branches.map((branch) => (
          <Pressable
            key={branch.key}
            accessibilityRole="link"
            accessibilityLabel={branch.label}
            accessibilityHint={t('perk_stores_hint')}
            onPress={() => setPicked({ label: branch.label, name: branch.name, brand, point: branch.point })}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <AppText autoDir style={styles.cardText} numberOfLines={2}>{branch.label}</AppText>
          </Pressable>
        ))}
      </ScrollView>
      {branches.length > 0 && <AppText style={styles.hint}>{t('perk_stores_hint')}</AppText>}
      <BranchNavigationSheet branch={picked} onClose={() => setPicked(null)} />
      {guide && <RedemptionGuide offer={offer} />}
    </View>
  )
}

/** How to redeem a multi-chain pass at any of its chains, in the reader's language; nothing when the admin wrote none. */
export function RedemptionGuide({ offer }: { offer: ReachOffer }) {
  const { t, lang } = useLang()
  const guide = offer.universalRedemptionGuide
  const text = guide ? (lang === 'he' ? guide.he || guide.en : guide.en || guide.he) : ''
  if (!text) return null
  return (
    <View>
      <AppText style={styles.guideTitle}>{t('perk_chains_redeem_title')}</AppText>
      <AppText style={styles.guide}>{text}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, flexShrink: 1 },
  icon: { marginTop: 2 },
  text: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.textMuted, flexShrink: 1 },
  textCompact: { fontSize: 11, lineHeight: 15 },
  chains: { gap: 14 },
  rail: { flexDirection: 'row', gap: 10, paddingVertical: 2 },
  // A plain rounded-rectangle card with a hairline border: a store, not a pill.
  card: { justifyContent: 'center', minWidth: 96, maxWidth: 240, minHeight: 44, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: colors.white, borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: 16, paddingVertical: 10, ...webOnly({ cursor: 'pointer' }) },
  cardPressed: { backgroundColor: colors.brandTint },
  hint: { fontSize: 12, lineHeight: 16, color: colors.textMuted, marginTop: -6 },
  cardText: { flexShrink: 1, fontSize: 14, lineHeight: 19, fontWeight: '600', color: colors.textStrong },
  guideTitle: { fontSize: 14, fontWeight: '700', color: colors.textStrong, marginBottom: 4 },
  guide: { fontSize: 15, lineHeight: 22, color: colors.body },
})
