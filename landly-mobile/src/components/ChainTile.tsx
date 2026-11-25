import { memo, useState } from 'react'
import { Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import { raayonitCategoryName } from '@shared/offers/raayonitCategories'
import { localizedBusinessName } from '@shared/business/businessText'
import { redemptionBadge, REDEMPTION_BADGE_KEYS } from '@shared/offers/raayonitRegions'
import AppText from './AppText'
import DirectionalIcon from './DirectionalIcon'
import { useLang } from '../i18n/LangProvider'
import { openOffer } from '../lib/openOffer'
import { openAfterSheet } from '../lib/openAfterSheet'
import BrandMedia from './BrandMedia'
import { secureImageUrl } from '../lib/imageSource'
import { bundledBrandImage } from '../lib/raayonitBrandImages'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MARK = require('../../assets/images/raayonit-logo.png') as ImageSourcePropType

// A venue as a framed white card: the picture edge to edge on top, then the name, "Category · coverage" and a quiet redemption line
// with "Details". No pill boxes inside.
export default memo(function ChainTile({ offer, dismiss }: { offer: OfferDocument; dismiss?: () => void }) {
  const { t, lang } = useLang()
  const [failed, setFailed] = useState(false)
  const label = localizedBusinessName(offer, lang).text
  const url = offer.imageUrl
  const source = failed || !url ? MARK : bundledBrandImage(url) ?? { uri: secureImageUrl(url) }
  const count = offer.branches?.length ?? 0
  const photo = offer.logoKind === 'photo'
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => openAfterSheet(dismiss, () => openOffer(offer))} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.stage}>
        <BrandMedia source={source} cover={!failed && !!url && photo} recyclingKey={offer.id} onError={() => setFailed(true)} />
      </View>
      <View style={styles.body}>
        <AppText autoDir numberOfLines={1} style={styles.name}>{label}</AppText>
        <AppText autoDir numberOfLines={1} style={styles.count}>
          {[offer.raayonitCategory ? raayonitCategoryName(offer.raayonitCategory, lang) : null, count === 0 ? t('raayonit_nationwide') : count === 1 ? t('brands_one_branch') : t('raayonit_branch_count').replace('{count}', String(count))].filter(Boolean).join(' · ')}
        </AppText>
        <View style={styles.footRow}>
          <AppText numberOfLines={1} style={styles.redeem}>{t(REDEMPTION_BADGE_KEYS[redemptionBadge(offer)])}</AppText>
          <View style={styles.details}>
            <AppText numberOfLines={1} style={styles.detailsText}>{t('raayonit_details_link')}</AppText>
            <DirectionalIcon name="chevronEnd" size={14} color={colors.brand} strokeWidth={2} />
          </View>
        </View>
      </View>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  // The frame: white, hairline border, 16pt corners, a whisper of elevation; the picture is clipped to it.
  card: { width: '100%', borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', overflow: 'hidden', shadowColor: '#0B1B3D', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1, ...webOnly({ cursor: 'pointer' }) },
  stage: { aspectRatio: 16 / 10, backgroundColor: '#EEF2F7', overflow: 'hidden' },
  body: { padding: 12, gap: 2 },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.textStrong },
  count: { fontSize: 12, lineHeight: 16, color: '#64748B' },
  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  redeem: { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 16, color: '#475569' },
  details: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailsText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.brand },
})
