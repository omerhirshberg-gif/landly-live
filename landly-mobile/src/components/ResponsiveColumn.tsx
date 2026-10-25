import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { CONTENT_MAX_WIDTH } from '../lib/layout'

// A centred column that stops growing at `maxWidth` (the member column by
// default), so an unfolded foldable or a tablet shows the screen as a bounded
// page rather than one phone layout stretched edge to edge. On a phone it's
// just full width. The native counterpart of the web build's
// webOnly({ maxWidth, alignSelf: 'center' }).
export default function ResponsiveColumn({
  children,
  maxWidth = CONTENT_MAX_WIDTH,
  style,
}: {
  children: ReactNode
  maxWidth?: number
  style?: StyleProp<ViewStyle>
}) {
  return <View style={[styles.column, { maxWidth }, style]}>{children}</View>
}

const styles = StyleSheet.create({
  column: { width: '100%', alignSelf: 'center' },
})
