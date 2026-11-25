import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

type At = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'

// Pins a child to one corner of its parent, by reading direction. The app
// keeps I18nManager.allowRTL(false) and flips Hebrew through the root view's
// `direction`, and whether an absolutely positioned `start` / `end` inset
// follows that depends on the platform. This does not use one: it fills the
// parent on all four (symmetric) sides and lets a flex row place the child, and
// a row, `justifyContent` and the child's `marginStart` / `marginEnd` always
// follow `direction`. `top-end` is the top right in English and the top left in
// Hebrew. Offsets are margins, so they may be negative (a glow that bleeds out
// of the card). The container ignores touches; the child keeps its own.
export default function Corner({
  at,
  top,
  bottom,
  start,
  end,
  children,
  style,
}: {
  at: At
  /** Distance from the corner's own edges, in dp; negative bleeds past the parent. */
  top?: number
  bottom?: number
  start?: number
  end?: number
  children: ReactNode
  style?: ViewStyle
}) {
  const atEnd = at.endsWith('end')
  const atBottom = at.startsWith('bottom')
  return (
    <View
      pointerEvents="box-none"
      style={[styles.fill, { justifyContent: atEnd ? 'flex-end' : 'flex-start', alignItems: atBottom ? 'flex-end' : 'flex-start' }]}
    >
      <View pointerEvents="box-none" style={[{ marginTop: top, marginBottom: bottom, marginStart: start, marginEnd: end }, style]}>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
})
