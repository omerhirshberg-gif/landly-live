import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

// One emoji in a fixed square box, drawn by the platform's own emoji font
// (Apple Color Emoji on iOS, Noto Color Emoji on Android). The box is
// size x 1.25 on both, the glyph centred in it, so a row lines up the same on
// either platform: Android drops its extra font padding. Decorative: the
// label beside it carries the meaning, so screen readers skip it. Its own
// view, never part of a label's string, so a row's direction (not bidi)
// places it in Hebrew. Text scaling is capped so it grows with Dynamic Type
// without breaking the chip or tile it sits in.
export default function Emoji({ glyph, size, style }: { glyph: string; size: number; style?: StyleProp<ViewStyle> }) {
  const box = Math.round(size * 1.25)
  return (
    <View
      style={[styles.box, { width: box, height: box }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        style={[styles.glyph, { fontSize: size, lineHeight: box }]}
        maxFontSizeMultiplier={1.3}
        // Never clipped to "…" by a narrow parent.
        numberOfLines={1}
      >
        {glyph}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  glyph: {
    textAlign: 'center',
    ...Platform.select({ android: { includeFontPadding: false, textAlignVertical: 'center' as const } }),
  },
})
