import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated'
import AppText from './AppText'
import LineIcon, { type LineIconName } from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

const MOTION_MS = 200

// The amber "Verification required" card under the email or phone row of the
// Profile tab (web: components/profile/PendingChangeNotice.tsx), shown while
// users/{uid}.pendingEmail / pendingPhone is set; the parent mounts it only
// then, so it fades in and out with the pending change (Reanimated skips the
// motion under the OS's reduced-motion setting). `message` holds a
// placeholder where the value goes, wrapped in LRI…PDI so "+1 415…" or an
// address stays left-to-right inside Hebrew. The buttons sit at the trailing
// edge below the text, which keeps a 320pt-wide screen from squeezing either.
export default function PendingChangeNotice({
  message,
  placeholder,
  value,
  icon,
  actionLabel,
  onAction,
  actionBusy,
  onCancel,
  cancelBusy,
  status,
}: {
  message: string
  placeholder: '{email}' | '{phone}'
  value: string
  icon: LineIconName
  actionLabel: string
  onAction: () => void
  actionBusy?: boolean
  onCancel: () => void
  cancelBusy?: boolean
  /** A one-line result under the card ("A new link is on its way.", or an error). */
  status?: { tone: 'info' | 'error'; text: string } | null
}) {
  const { t } = useLang()
  const busy = actionBusy || cancelBusy
  const text = message.replace(placeholder, `⁦${value}⁩`)

  return (
    <Animated.View
      entering={FadeIn.duration(MOTION_MS)}
      exiting={FadeOut.duration(MOTION_MS)}
      layout={LinearTransition.duration(MOTION_MS)}
      style={styles.wrap}
    >
      <View style={styles.box} accessibilityLiveRegion="polite">
        <View style={styles.top}>
          <View style={styles.icon}>
            <LineIcon name={icon} size={18} color={colors.warningIcon} />
          </View>
          <AppText style={styles.text}>
            <AppText style={styles.title}>{`${t('pending_title')}: `}</AppText>
            {text}
          </AppText>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            disabled={busy}
            hitSlop={4}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressedText, busy && styles.disabled]}
          >
            {cancelBusy ? <ActivityIndicator size="small" color={colors.warningText} /> : <AppText style={styles.cancelText}>{t('pending_cancel')}</AppText>}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: !!actionBusy, disabled: !!busy }}
            onPress={onAction}
            disabled={busy}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed, busy && styles.disabled]}
          >
            {actionBusy ? <ActivityIndicator size="small" color={colors.warningText} /> : <AppText style={styles.actionText}>{actionLabel}</AppText>}
          </Pressable>
        </View>
      </View>
      {status && (
        <AppText
          accessibilityRole={status.tone === 'error' ? 'alert' : 'text'}
          accessibilityLiveRegion={status.tone === 'error' ? 'assertive' : 'polite'}
          style={[styles.status, status.tone === 'error' && styles.statusError]}
        >
          {status.text}
        </AppText>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  box: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    gap: 10,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon: { paddingTop: 1 },
  text: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.warningText },
  title: { fontWeight: '700', color: colors.warningText },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  cancel: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  cancelText: { fontSize: 13, fontWeight: '600', color: colors.warningText, textDecorationLine: 'underline' },
  action: {
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warningAction,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
  actionPressed: { backgroundColor: colors.warningPressed },
  actionText: { fontSize: 14, fontWeight: '700', color: colors.warningText },
  pressedText: { opacity: 0.7 },
  disabled: { opacity: 0.6 },
  status: { marginTop: 6, fontSize: 12, fontWeight: '600', color: colors.warningText },
  statusError: { color: colors.danger },
})
