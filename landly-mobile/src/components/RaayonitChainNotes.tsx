import { StyleSheet, View } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import { hasNoBranchTable, isChain } from '@shared/offers/discoverTab'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

// What a Raayonit chain's page says up front (web: components/raayonit/RaayonitChainNotes.tsx): the hotel rule on a hotel, and a note
// that branches vary when the chain's tile carries no branch table of its own.
export default function RaayonitChainNotes({ offer }: { offer: OfferDocument }) {
  const { t } = useLang()
  if (!isChain(offer)) return null
  const hotel = offer.raayonitCategory === 'hotels'
  const vary = hasNoBranchTable(offer)
  if (!hotel && !vary) return null
  return (
    <View style={styles.wrap}>
      {hotel && <Note text={t('raayonit_hotel_notice')} />}
      {vary && <Note text={t('raayonit_branches_vary')} />}
    </View>
  )
}

function Note({ text }: { text: string }) {
  return (
    <View style={styles.note}>
      <LineIcon name="help" size={18} color={colors.brand} strokeWidth={1.75} />
      <AppText style={styles.text}>{text}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 16 },
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#F0F7FF', borderWidth: 1, borderColor: 'rgba(0,56,184,0.18)' },
  text: { flex: 1, fontSize: 13, lineHeight: 20, color: colors.heading },
})
