import { Pressable, StyleSheet, View } from 'react-native'
import { suggestEmail } from '@shared/validation/emailTypo'
import AppText from './AppText'
import { colors, radius } from '../theme'

// "Did you mean name@icloud.com?" with a one-tap fix, under an email field
// (web: components/forms/EmailTypoHint.tsx, same detection in
// lib/validation/emailTypo.ts). `message` carries an {email} placeholder; the
// address is wrapped in left-to-right isolates so it reads correctly inside
// Hebrew. Nothing is shown when the address looks fine. A hint, never a block.
export default function EmailTypoHint({ value, message, actionLabel, onApply }: {
  value: string
  message: string
  actionLabel: string
  onApply: (email: string) => void
}) {
  const suggestion = suggestEmail(value)
  if (!suggestion) return null
  const [before, after = ''] = message.split('{email}')
  return (
    <View accessibilityLiveRegion="polite" style={styles.box}>
      <AppText style={styles.text}>
        {before}
        <AppText style={styles.email}>{`⁦${suggestion.email}⁩`}</AppText>
        {after}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel} ${suggestion.email}`}
        onPress={() => onApply(suggestion.email)}
        hitSlop={4}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <AppText style={styles.actionText}>{actionLabel}</AppText>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    marginTop: -8,
    marginBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingStart: 14,
    paddingEnd: 6,
    paddingVertical: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningBg,
  },
  text: { flexShrink: 1, fontSize: 14, lineHeight: 20, color: colors.warningText },
  email: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  action: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 10, borderRadius: radius.md },
  pressed: { backgroundColor: colors.warningPressed },
  actionText: { fontSize: 14, fontWeight: '700', color: colors.brand },
})
