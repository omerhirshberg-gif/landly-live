import { useMemo } from 'react'
import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  categoryColumns,
  feedColumns,
  formFactor,
  gridCellWidth,
  screenGutter,
  sidePadding,
  sheetMaxWidth,
  usesPanes,
  type FormFactor,
} from './layout'

export interface Layout {
  width: number
  height: number
  isLandscape: boolean
  formFactor: FormFactor
  /** The side gutter for this width (12 / 16 / 24). */
  gutter: number
  /**
   * A screen's left and right padding: that side's safe-area inset plus the
   * gutter (more once the member column is capped). Edge-bleeding rails reach
   * out by exactly this much, so they scroll under a cutout but rest clear of it.
   */
  paddingLeft: number
  paddingRight: number
  /** Cards per row in the perk and voucher feeds. */
  columns: number
  /** Cards per row in the category grid. */
  categoryColumns: number
  /** The width the feed's rows span, side padding taken off and capped at the member column. */
  rowWidth: number
  /** One feed cell's width at `columns` per row. */
  cellWidth: number
  /** A sheet's or dialog's max width; undefined on phones (full width). */
  sheetMaxWidth: number | undefined
  /** Lay the offer and sign-in screens out as two panes. */
  panes: boolean
}

// The window as the layout sees it: re-read on every size change, so folding
// or unfolding the phone (or rotating the inner screen) re-lays the screen
// out on the spot, without a restart. The safe-area insets are read with it:
// held landscape, an unfolded foldable's camera cutout moves to a side, and
// the padding on that side grows to clear it. Thresholds: src/lib/layout.ts.
export function useLayout(): Layout {
  const { width, height } = useWindowDimensions()
  const { left: insetLeft, right: insetRight } = useSafeAreaInsets()
  return useMemo(() => {
    const factor = formFactor(width)
    const gutter = screenGutter(factor)
    const columns = feedColumns(factor)
    const side = sidePadding(width, gutter, insetLeft, insetRight)
    const rowWidth = Math.max(0, width - side.left - side.right)
    return {
      width,
      height,
      isLandscape: width > height,
      formFactor: factor,
      gutter,
      paddingLeft: side.left,
      paddingRight: side.right,
      columns,
      categoryColumns: categoryColumns(factor),
      rowWidth,
      cellWidth: gridCellWidth(rowWidth, columns),
      sheetMaxWidth: sheetMaxWidth(width),
      panes: usesPanes(factor),
    }
  }, [width, height, insetLeft, insetRight])
}
