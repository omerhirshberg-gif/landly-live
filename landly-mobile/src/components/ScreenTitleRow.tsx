import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import AppText from './AppText'
import { header, type } from '../theme'

// A tab screen's title row (theme.ts `header`): at least 48pt tall, its
// contents centred on one line, so a title, Home's 48pt avatar and greeting,
// and Profile's 44pt Settings gear all share one baseline height. `title`
// renders the screen title; `children` stands in for it (Home's greeting).
// `trailing` sits at the reading-direction end. The space under it belongs
// to the screen (header.gap), so a header group can set its own.
export default function ScreenTitleRow({
  title,
  children,
  trailing,
  style,
}: {
  title?: string
  children?: ReactNode
  trailing?: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.row, style]}>
      {title !== undefined ? (
        <AppText accessibilityRole="header" style={[type.screenTitle, styles.title]}>
          {title}
        </AppText>
      ) : (
        children
      )}
      {trailing}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: header.row },
  title: { flex: 1, minWidth: 0 },
})
