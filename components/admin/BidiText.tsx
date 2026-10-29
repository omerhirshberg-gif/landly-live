// A name or title that may be Hebrew or English, in a list or a card: it
// reads in its own direction (an isolated <bdi dir="auto">, so "₪15", dates
// and punctuation around it don't hop), but lines up with the column's start
// edge rather than its own (text-align: match-parent), so every row of a
// column starts at the same edge. One line with an ellipsis at the text's
// own end, or `lines` for a clamped block.
export default function BidiText({ children, lines, className = '' }: { children: React.ReactNode; lines?: 2 | 3; className?: string }) {
  const clamp = lines === 2 ? 'line-clamp-2' : lines === 3 ? 'line-clamp-3' : 'truncate'
  return (
    <bdi dir="auto" className={`block min-w-0 [text-align:match-parent] ${clamp} ${className}`}>
      {children}
    </bdi>
  )
}
