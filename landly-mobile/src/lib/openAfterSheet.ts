// Opens a screen from a button inside a bottom-sheet Modal. A React Native Modal is
// its own native layer above the whole navigator, so a screen pushed while it is up
// opens behind it; and pushing in the same frame as the dismissal races it. So the
// sheet closes first and the screen opens once the Modal has gone (its fade is
// ~200ms). Without a `dismiss` (a tile on the page itself) it opens at once.
export const SHEET_DISMISS_MS = 320

export function openAfterSheet(dismiss: (() => void) | undefined, open: () => void): void {
  if (!dismiss) {
    open()
    return
  }
  dismiss()
  setTimeout(open, SHEET_DISMISS_MS)
}
