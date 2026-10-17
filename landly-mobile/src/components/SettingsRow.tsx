import type { ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import AppText from './AppText'
import LineIcon, { type LineIconName } from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// One row of the settings stack (web: components/settings/SettingsRow.tsx):
// icon tile, title, optional subtitle and a chevron along the reading
// direction. `selected` swaps the chevron for a check (a choice list).
export default function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  selected,
  role = 'button',
  last = false,
}: {
  icon?: LineIconName
  title: string
  subtitle?: string
  onPress: () => void
  /** A choice row: checked or not, no chevron. */
  selected?: boolean
  role?: 'button' | 'link' | 'radio'
  last?: boolean
}) {
  const { isRtl } = useLang()
  const choice = selected !== undefined
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={choice ? { checked: selected } : undefined}
      onPress={onPress}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [styles.row, !last && styles.border, pressed && Platform.OS === 'ios' && styles.pressed]}
    >
      {icon && (
        <View style={styles.iconBox}>
          <LineIcon name={icon} color={colors.brand} />
        </View>
      )}
      <View style={styles.text}>
        <AppText style={[styles.title, selected && styles.titleSelected]} numberOfLines={1}>
          {title}
        </AppText>
        {!!subtitle && (
          <AppText style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>
      {choice ? (
        selected && <LineIcon name="check" color={colors.brand} strokeWidth={2.6} />
      ) : (
        <LineIcon name="chevronEnd" color={colors.textFaint} strokeWidth={2.2} flip={isRtl} />
      )}
    </Pressable>
  )
}

// A titled white card holding rows.
export function SettingsGroup({ title, children, tone = 'default' }: { title: string; children: ReactNode; tone?: 'default' | 'danger' }) {
  return (
    <View style={styles.group}>
      <AppText accessibilityRole="header" style={[styles.groupTitle, tone === 'danger' && styles.groupTitleDanger]}>
        {title}
      </AppText>
      {tone === 'danger' ? children : <View style={styles.card}>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.white,
    ...webOnly({ cursor: 'pointer' }),
  },
  border: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  pressed: { backgroundColor: colors.background },
  iconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '600', color: colors.heading },
  titleSelected: { color: colors.brand },
  subtitle: { marginTop: 1, fontSize: 13, color: colors.textMuted },
  group: { marginBottom: 24 },
  groupTitle: { fontSize: 14, fontWeight: '600', color: colors.textFaint, marginBottom: 8, paddingHorizontal: 4 },
  groupTitleDanger: { color: colors.danger },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
})
