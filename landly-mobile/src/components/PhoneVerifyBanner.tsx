import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// The Profile screen's "Complete your profile" card (web:
// components/profile/PhoneVerifyBanner.tsx), shown while the member's phone
// isn't verified, in the manner of Apple's Settings: a plain white card with
// a hairline border, a small icon tile, a title, one line on why, and a
// compact action. The ✕ (a 44pt target) hides the card for 7 days; the Profile
// tab's red "1" stays until the number is verified. Corners and the ✕ follow
// the layout direction, so Hebrew mirrors them.
export default function PhoneVerifyBanner({
  onVerify,
  onDismiss,
  busy,
  error,
}: {
  onVerify: () => void
  onDismiss: () => void
  busy?: boolean
  error?: string | null
}) {
  const { t } = useLang()
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <LineIcon name="phone" size={20} color={colors.warningIcon} strokeWidth={1.75} />
        </View>
        <View style={styles.text}>
          <AppText accessibilityRole="header" style={styles.title}>{t('phone_nudge_title')}</AppText>
          <AppText style={styles.body}>{t('phone_nudge_body')}</AppText>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: !!busy, disabled: !!busy }}
        onPress={onVerify}
        disabled={busy}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        {busy ? <ActivityIndicator size="small" color={colors.white} /> : <AppText style={styles.ctaText}>{t('phone_nudge_cta')}</AppText>}
      </Pressable>
      {!!error && (
        <AppText accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>
          {error}
        </AppText>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('phone_nudge_dismiss')}
        onPress={onDismiss}
        disabled={busy}
        hitSlop={0}
        style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}
      >
        <LineIcon name="close" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
    gap: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingEnd: 36 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.heading },
  body: { fontSize: 14, lineHeight: 20, color: colors.body },
  cta: {
    alignSelf: 'flex-start',
    minHeight: 44,
    minWidth: 112,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
  ctaPressed: { backgroundColor: colors.brandHover },
  ctaText: { fontSize: 14, fontWeight: '700', color: colors.white },
  error: { fontSize: 13, fontWeight: '600', color: colors.danger },
  dismiss: {
    position: 'absolute',
    top: 0,
    end: 0,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
  dismissPressed: { opacity: 0.6 },
})
