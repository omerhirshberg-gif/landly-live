import { StyleSheet, View } from 'react-native'
import { NOTIFICATION_POINTS } from '@shared/brand/onboardingIcons'
import Button from '../../components/Button'
import { useLang } from '../../i18n/LangProvider'
import PointList from './PointList'

// "Enable" asks the OS for permission (iOS / Android dialog); "Maybe Later"
// asks nothing. Either one saves the answers and moves on to the celebration.
export function NotificationPoints() {
  const { t } = useLang()
  return <PointList points={NOTIFICATION_POINTS.map((p) => ({ icon: p.icon, label: t(p.key) }))} />
}

export default function NotificationsActions({
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
    <View style={styles.actions}>
      <Button label={t('onb_notif_enable')} onPress={onEnable} busy={busy === 'enable'} disabled={busy === 'later'} large />
      <Button label={t('onb_notif_later')} onPress={onLater} busy={busy === 'later'} disabled={busy === 'enable'} variant="secondary" />
    </View>
  )
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
})
