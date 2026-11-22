import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { isolateLtr } from '@shared/home/superShowcase'
import { isFlagship } from '@shared/offers/discoverTab'
import { roundedCount } from '@shared/offers/raayonitPreview'
import { useOffers } from '@shared/offers/useOffers'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

// The eyebrow of the flagship Raayonit Card in place of the OfferTags line (web: components/offers/FlagshipEyebrow.tsx). The card is a multi-chain
// voucher, so it never wears the single category the legacy flagship document still carries, nor an "Online & in store" tag.
export default function FlagshipEyebrow() {
  const { t } = useLang()
  const { offers } = useOffers()
  const count = useMemo(() => roundedCount((offers ?? []).filter((o) => o.fulfillmentType === 'raayonit_pool' && !isFlagship(o)).length), [offers])
  return (
    <View style={styles.row}>
      <LineIcon name="layers" size={14} color={colors.body} strokeWidth={1.75} />
      <AppText numberOfLines={1} style={styles.text}>{t('flagship_eyebrow').replace('{count}+', isolateLtr(`${count}+`))}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  text: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.body },
})
