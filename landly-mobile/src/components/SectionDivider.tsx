import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { colors } from '../theme'

// The hairline between a screen's sections (native counterpart of
// components/ui/SectionDivider.tsx): brand blue at 25%, fading out at both
// ends, so it reads the same in English and Hebrew. Purely decorative, so
// it's hidden from screen readers.
export default function SectionDivider({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.line, style]}>
      <Svg width="100%" height={1}>
        <Defs>
          {/* One shared id: every divider draws the identical gradient, so a clash on web is harmless. */}
          <LinearGradient id="landlySectionDivider" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.brand} stopOpacity={0} />
            <Stop offset="0.5" stopColor={colors.brand} stopOpacity={0.25} />
            <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="1" fill="url(#landlySectionDivider)" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  line: { height: 1, alignSelf: 'stretch' },
})
