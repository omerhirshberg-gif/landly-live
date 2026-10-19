import { StyleSheet, View } from 'react-native'
import AppText from './AppText'
import { colors, radius } from '../theme'

const TONES = {
  error: { box: { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }, text: colors.danger },
  success: { box: { backgroundColor: colors.successBg, borderColor: colors.successBorder }, text: colors.success },
  // blue-50 / blue-200, as on the web.
  info: { box: { backgroundColor: colors.brandTint, borderColor: colors.brandLight }, text: colors.brand },
} as const

// `info` is a progress line ("Sending…"), announced politely rather than as an alert.
export default function Notice({ message, tone = 'error' }: { message: string; tone?: keyof typeof TONES }) {
  return (
    <View
      accessibilityRole={tone === 'info' ? 'text' : 'alert'}
      accessibilityLiveRegion={tone === 'info' ? 'polite' : 'assertive'}
      style={[styles.box, TONES[tone].box]}
    >
      <AppText style={[styles.text, { color: TONES[tone].text }]}>{message}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  text: { fontSize: 14, fontWeight: '600' },
})
