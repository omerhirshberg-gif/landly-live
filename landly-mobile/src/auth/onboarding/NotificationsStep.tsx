import { StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import type { TranslationKey } from '@shared/i18n/translations'
import AppText from '../../components/AppText'
import Button from '../../components/Button'
import { useLang } from '../../i18n/LangProvider'
import { colors } from '../../theme'

const BENEFITS: TranslationKey[] = ['onb_notif_drops', 'onb_notif_redemptions', 'onb_notif_updates']

// Last step. "Enable" asks the OS for permission; "Maybe Later" asks
// nothing. Either one finishes onboarding.
export default function NotificationsStep({
  busy,
  onEnable,
  onLater,
}: {
  busy: 'enable' | 'later' | null
  onEnable: () => void
  onLater: () => void
}) {
  const { t } = useLang()
  return (
    <>
      <View style={styles.list}>
        {BENEFITS.map((key) => (
          <View key={key} style={styles.item}>
            <View style={styles.check}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.brand} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M20 6 9 17l-5-5" />
              </Svg>
            </View>
            <AppText style={styles.itemText}>{t(key)}</AppText>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Button label={t('onb_notif_enable')} onPress={onEnable} busy={busy === 'enable'} disabled={busy === 'later'} large />
        <Button label={t('onb_notif_later')} onPress={onLater} busy={busy === 'later'} disabled={busy === 'enable'} variant="secondary" />
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  list: { gap: 10, marginBottom: 24 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  itemText: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  actions: { gap: 10 },
})
