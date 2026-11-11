// A name or title that may be Hebrew or English, in a list or a card: it
// reads in its own direction (an isolated <bdi dir="auto">, so "₪15", dates
// and punctuation around it don't hop), but lines up with the column's start
// edge rather than its own: the block around the <bdi> keeps the page's
// direction and aligns `text-start`, so every row of a column is anchored at
// the same edge (the right in Hebrew, the left in English) even when a name
// is in the other script. (text-align: match-parent on the <bdi> itself
// resolves against the name's own direction in Chrome, which defeats that.)
// One line with an ellipsis at the text's own end, or `lines` for a clamped
// block that wraps at word boundaries.
export default function BidiText({ children, lines, className = '' }: { children: React.ReactNode; lines?: 2 | 3; className?: string }) {
  const clamp = lines === 2 ? 'line-clamp-2 break-words' : lines === 3 ? 'line-clamp-3 break-words' : 'truncate'
  return (
    <span className={`block min-w-0 text-start ${clamp} ${className}`}>
      <bdi dir="auto">{children}</bdi>
    </span>
  )
}
