import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import { useLayout } from '../lib/useLayout'

/** The dim behind every bottom sheet (SortSheet, AreaPicker, AvatarPicker, OtpSheet). */
export const SCRIM_COLOR = 'rgba(11, 27, 61, 0.32)'

// The bottom row a sheet rises in, under its scrim. On a phone the sheet spans
// the screen and this adds nothing. From 600pt (an unfolded foldable, a
// tablet; src/lib/layout.ts) the sheet is a centred card no wider than the
// website's dialogs, and this row carries the scrim's dim out to the screen's
// edges beside it, so the page never shows through undimmed at the sides.
export default function SheetSlot({ children }: { children: ReactNode }) {
  const { sheetMaxWidth } = useLayout()
  if (!sheetMaxWidth) return <>{children}</>
  return <View style={styles.slot}>{children}</View>
}

/** The sheet's own width cap, spread into its style: undefined on a phone. */
export function useSheetBounds(): ViewStyle | undefined {
  const { sheetMaxWidth } = useLayout()
  return sheetMaxWidth ? { width: '100%', maxWidth: sheetMaxWidth, alignSelf: 'center' } : undefined
}

/**
 * A full-screen modal (Delete account, the country code list): side padding
 * that centres its content in a dialog-wide column from 600pt, 0 on a phone.
 */
export function useModalSidePadding(): number {
  const { width, sheetMaxWidth } = useLayout()
  return sheetMaxWidth ? Math.max(0, (width - sheetMaxWidth) / 2) : 0
}

const styles = StyleSheet.create({
  slot: { alignItems: 'center', backgroundColor: SCRIM_COLOR },
})
