import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import AppText from './AppText'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// A label may hold tappable links (the sign-up consent line, ConsentText);
// they stop the press so following one doesn't also toggle the box.
// `invalid` draws the box red.
export default function Checkbox({
  label,
  checked,
  onChange,
  invalid,
}: {
  label: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  invalid?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      style={styles.row}
    >
      <View style={[styles.box, invalid && !checked && styles.boxInvalid, checked && styles.boxChecked]}>
        {checked && (
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={colors.white} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M20 6 9 17l-5-5" />
          </Svg>
        )}
      </View>
      <AppText style={styles.label}>{label}</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, ...webOnly({ cursor: 'pointer', userSelect: 'none' }) },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.textFaint,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxInvalid: { borderColor: colors.danger },
  boxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  // flexShrink lets a long label (the consent line) wrap beside the box.
  label: { flexShrink: 1, fontSize: 13, lineHeight: 19, fontWeight: '600', color: colors.text },
})
