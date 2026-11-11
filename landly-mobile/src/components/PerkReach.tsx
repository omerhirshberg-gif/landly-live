import { StyleSheet, View } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { colors, radius } from '../theme'

type ReachOffer = Pick<OfferDocument, 'fulfillmentType' | 'perkScope' | 'participatingChains' | 'chainsCount' | 'universalRedemptionGuide'>

export const isMultiChain = (offer: Pick<ReachOffer, 'perkScope'>) => offer.perkScope === 'multi_chain'

/** Where a Multipass perk works, in place of a store's address: the chain count, or "nationwide" for one brand. Null for a local-business perk. */
export function PerkReachLine({ offer, hasPlace = false, compact = false }: { offer: ReachOffer; hasPlace?: boolean; compact?: boolean }) {
  const { t } = useLang()
  const multi = isMultiChain(offer)
  if (!multi && !(offer.fulfillmentType === 'multipass_pool' && !hasPlace)) return null
  const text = multi ? t('perk_honoured_at_chains').replace('{n}', `⁦${offer.chainsCount ?? 0}⁩`) : t('perk_nationwide')
  return (
    <View style={styles.line}>
      <LineIcon name={multi ? 'ticket' : 'globe'} size={12} color={colors.brand} strokeWidth={1.75} />
      <AppText style={[styles.text, compact && styles.textCompact]} numberOfLines={1}>{text}</AppText>
    </View>
  )
}

/** The chains that honour a multi-chain voucher, as tags, with the guide that applies at all of them. */
export function ParticipatingChains({ offer }: { offer: ReachOffer }) {
  const { t, lang } = useLang()
  const guide = offer.universalRedemptionGuide
  const text = guide ? (lang === 'he' ? guide.he || guide.en : guide.en || guide.he) : ''
  return (
    <View style={styles.chains}>
      <View style={styles.tags}>
        {(offer.participatingChains ?? []).map((name) => (
          <View key={name} style={styles.tag}>
            <AppText style={styles.tagText}>{name}</AppText>
          </View>
        ))}
      </View>
      {!!text && (
        <View>
          <AppText style={styles.guideTitle}>{t('perk_chains_redeem_title')}</AppText>
          <AppText style={styles.guide}>{text}</AppText>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  text: { fontSize: 12, fontWeight: '500', color: colors.textMuted, flexShrink: 1 },
  textCompact: { fontSize: 11 },
  chains: { gap: 14 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderWidth: 1, borderColor: colors.border, backgroundColor: '#F8FAFC', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  tagText: { fontSize: 14, fontWeight: '500', color: colors.textStrong },
  guideTitle: { fontSize: 14, fontWeight: '700', color: colors.textStrong, marginBottom: 4 },
  guide: { fontSize: 15, lineHeight: 22, color: colors.body },
})
