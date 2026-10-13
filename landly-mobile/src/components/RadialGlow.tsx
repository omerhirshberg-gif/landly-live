import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import { colors } from '../theme'

// A soft circular glow (brand blue by default) that fades to transparent at
// its edge. Static, so it costs nothing per frame; position it with `style`.
export default function RadialGlow({
  size,
  color = colors.brand,
  intensity = 0.22,
  style,
}: {
  size: number
  color?: string
  intensity?: number
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View pointerEvents="none" style={[styles.wrap, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={intensity} />
            <Stop offset="0.5" stopColor={color} stopOpacity={intensity * 0.45} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#glow)" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
})
