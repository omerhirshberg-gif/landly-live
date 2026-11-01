// The share card's renderer (next/og) lays every line out left to right, so a
// Hebrew string comes out backwards. This turns one line into visual order:
// the characters reversed, with each run of digits or Latin letters kept
// reading left to right. One line only: the card breaks its own lines.
const LTR_RUN = /[0-9A-Za-z.,:/%-]+/g

export function visualHebrewLine(text: string): string {
  const reversed = Array.from(text).reverse().join('')
  return reversed.replace(LTR_RUN, (run) => Array.from(run).reverse().join(''))
}
