import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { GRID_GAP } from '../lib/layout'
import { useLayout } from '../lib/useLayout'

// One card's slot in a feed laid out in columns (an unfolded foldable or a
// tablet; src/lib/layout.ts): a fixed width, so a short last row keeps its
// cards the size of the rest rather than one stretching across the screen. On
// a phone (one column) the card renders as it always has.
//
// In a FlashList (no columnWrapperStyle) every column gets an equal share of
// the row; `column` shifts the card within its share by column x gap / columns,
// which puts exactly GRID_GAP between neighbours and the last card flush with
// the row's end edge. Start/end, so Hebrew mirrors it.
/** `grid` overrides the feed's columns, for a screen that lays its cards out in its own grid (the category screen: two on a phone). */
export default function FeedCell({ children, column, grid }: { children: ReactNode; column?: number; grid?: { columns: number; cellWidth: number } }) {
  const feed = useLayout()
  const { columns, cellWidth } = grid ?? feed
  if (columns <= 1) return <>{children}</>
  const shift = column === undefined ? 0 : (column % columns) * (GRID_GAP / columns)
  return <View style={{ width: cellWidth, marginStart: shift }}>{children}</View>
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
