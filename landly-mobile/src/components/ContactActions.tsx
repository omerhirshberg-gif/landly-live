import { Linking, Pressable, StyleSheet, View } from 'react-native'
import { firstPhone, normalizeWebsiteUrl } from '@shared/offers/contact'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// The business's own website and, for a single-location business, its phone: two quiet buttons under the offer's (or voucher's) header.
// Each shows only when the card has the field. The number is isolated left-to-right inside a right-to-left screen.
// Web: components/offers/ContactActions.tsx.
export default function ContactActions({ websiteUrl, phone, stack = false }: { websiteUrl?: string; phone?: string; stack?: boolean }) {
  const { t } = useLang()
  const site = normalizeWebsiteUrl(websiteUrl)
  const call = firstPhone(phone)
  if (!site && !call) return null
  return (
    <View style={stack ? styles.column : styles.row}>
      {site ? (
        <Pressable accessibilityRole="link" accessibilityLabel={t('offer_visit_website')} onPress={() => Linking.openURL(site).catch(() => {})} style={({ pressed }) => [styles.button, stack && styles.buttonStack, pressed && styles.pressed]}>
          <LineIcon name="globe" size={16} color={colors.brand} strokeWidth={1.75} />
          <AppText style={styles.label}>{t('offer_visit_website')}</AppText>
        </Pressable>
      ) : null}
      {call ? (
        <Pressable accessibilityRole="link" accessibilityLabel={`${t('offer_call')} ${call.display}`} onPress={() => Linking.openURL(call.href).catch(() => {})} style={({ pressed }) => [styles.button, stack && styles.buttonStack, pressed && styles.pressed]}>
          <LineIcon name="call" size={16} color={colors.brand} strokeWidth={1.75} />
          <AppText ltr style={styles.label}>{call.display}</AppText>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // A full-width, 52pt row in a column (the offer page's action stack), the label centred.
  column: { alignSelf: 'stretch', gap: 12 },
  buttonStack: { alignSelf: 'stretch', minHeight: 52, justifyContent: 'center', borderRadius: 16 },
  button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 14, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', ...webOnly({ cursor: 'pointer' }) },
  pressed: { opacity: 0.6 },
  label: { fontSize: 14, fontWeight: '700', color: colors.brand },
})
