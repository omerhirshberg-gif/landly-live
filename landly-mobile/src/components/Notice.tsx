import { StyleSheet, View } from 'react-native'
import AppText from './AppText'
import { colors, radius } from '../theme'

export default function Notice({ message, tone = 'error' }: { message: string; tone?: 'error' | 'success' }) {
  const error = tone === 'error'
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.box,
        error
          ? { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }
          : { backgroundColor: colors.successBg, borderColor: colors.successBorder },
      ]}
    >
      <AppText style={[styles.text, { color: error ? colors.danger : colors.success }]}>{message}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  text: { fontSize: 14, fontWeight: '600' },
})
