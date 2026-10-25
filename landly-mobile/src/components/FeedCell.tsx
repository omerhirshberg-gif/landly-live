import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { GRID_GAP } from '../lib/layout'
import { useLayout } from '../lib/useLayout'

// One card's slot in a feed FlatList laid out in columns (an unfolded foldable
// or a tablet; src/lib/layout.ts): a fixed width, so a short last row keeps
// its cards the size of the rest rather than one stretching across the
// screen. On a phone (one column) the card renders as it always has.
export default function FeedCell({ children }: { children: ReactNode }) {
  const { columns, cellWidth } = useLayout()
  if (columns <= 1) return <>{children}</>
  return <View style={{ width: cellWidth }}>{children}</View>
}

/**
 * The FlatList's columnWrapperStyle: the gap between cards in a row. Only for
 * two columns or more; React Native rejects it on a single-column list.
 */
export function feedColumnWrapper(columns: number) {
  return columns > 1 ? styles.row : undefined
}

const styles = StyleSheet.create({
  row: { gap: GRID_GAP },
})
