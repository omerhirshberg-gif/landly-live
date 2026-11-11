// Mixed Hebrew/Latin text for pdf-lib, which draws glyphs left to right and
// knows nothing about bidirectional text. A line is split into runs by script,
// the runs are put in visual order, and Hebrew runs are reversed character by
// character; numbers and Latin words stay as typed. Not a full Unicode
// algorithm: enough for contract text, names and figures.

export type RunKind = 'he' | 'la'
export interface Run { text: string; kind: RunKind }

const isHebrew = (c: string) => /[֐-׿]/.test(c)
const isStrongLatin = (c: string) => /[A-Za-z0-9]/.test(c)
const MIRROR: Record<string, string> = { '(': ')', ')': '(', '[': ']', ']': '[', '<': '>', '>': '<' }

/** Runs in visual (left to right) order for a paragraph whose base direction is `rtl`. */
export function visualRuns(line: string, rtl: boolean): Run[] {
  const chars = [...line]
  const strong: (RunKind | null)[] = chars.map((c) => (isHebrew(c) ? 'he' : isStrongLatin(c) ? 'la' : null))
  const base: RunKind = rtl ? 'he' : 'la'
  const kinds: RunKind[] = chars.map((_, i) => {
    if (strong[i]) return strong[i]!
    let prev: RunKind | null = null, next: RunKind | null = null
    for (let j = i - 1; j >= 0 && !prev; j--) prev = strong[j] ?? null
    for (let j = i + 1; j < chars.length && !next; j++) next = strong[j] ?? null
    return prev && prev === next ? prev : base
  })
  const runs: Run[] = []
  chars.forEach((c, i) => {
    const last = runs[runs.length - 1]
    if (last && last.kind === kinds[i]) last.text += c
    else runs.push({ text: c, kind: kinds[i]! })
  })
  const ordered = rtl ? runs.reverse() : runs
  return ordered.map((run) => run.kind === 'he'
    ? { kind: 'he' as const, text: [...run.text].reverse().map((c) => MIRROR[c] ?? c).join('') }
    : run)
}
