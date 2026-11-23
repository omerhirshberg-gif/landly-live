import { memo, useState } from 'react'
import { Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import { localizedBusinessName } from '@shared/business/businessText'
import AppText from './AppText'
import BrandMedia from './BrandMedia'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { secureImageUrl } from '../lib/imageSource'
import { openOffer } from '../lib/openOffer'
import { bundledBrandImage } from '../lib/raayonitBrandImages'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MARK = require('../../assets/images/raayonit-logo.png') as ImageSourcePropType

export const LIVE_TILE_WIDTH = 168

// A participating chain on Home and Explore Perks (web: components/perks/LiveChainTile.tsx): the logo or photo, the name and one quiet line,
// a check and "Redeemable now". Smaller than the Raayonit tab's directory card (no category, branch count or details link): it says "this works today".
export default memo(function LiveChainTile({ offer }: { offer: OfferDocument }) {
  const { t, lang } = useLang()
  const [failed, setFailed] = useState(false)
  const label = localizedBusinessName(offer, lang).text
  const url = offer.imageUrl
  const source = failed || !url ? MARK : bundledBrandImage(url) ?? { uri: secureImageUrl(url) }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}. ${t('chains_live_badge')}`} onPress={() => openOffer(offer)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.stage}>
        <BrandMedia source={source} cover={!failed && !!url && offer.logoKind === 'photo'} recyclingKey={offer.id} onError={() => setFailed(true)} />
      </View>
      <View style={styles.body}>
        <AppText autoDir numberOfLines={1} style={styles.name}>{label}</AppText>
        <View style={styles.live}>
          <LineIcon name="circleCheck" size={14} color={colors.success} strokeWidth={1.75} />
          <AppText numberOfLines={1} style={styles.liveText}>{t('chains_live_badge')}</AppText>
        </View>
      </View>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  card: { width: LIVE_TILE_WIDTH, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, overflow: 'hidden', ...webOnly({ cursor: 'pointer' }) },
  stage: { aspectRatio: 4 / 3, backgroundColor: '#EEF2F7', overflow: 'hidden' },
  body: { paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  name: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: colors.textStrong },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveText: { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.success },
})
