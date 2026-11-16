// Detects a mistyped mail provider ("name@icloiud.com") and proposes the fix.
// Pure and client-safe: shared by /join, web sign-up, the profile and the
// native app. A hint only: it never blocks a submit, and only the domain is
// touched, never the part before the "@".

export interface EmailSuggestion {
  /** The full corrected address. */
  email: string
  /** The corrected domain alone. */
  domain: string
}

/** Providers whose misspellings we correct (also the targets of the distance match). */
export const TRUSTED_DOMAINS: readonly string[] = [
  'gmail.com',
  'icloud.com',
  'me.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'walla.co.il',
  'walla.com',
  'bezeqint.net',
  'netvision.net.il',
  'proton.me',
  'protonmail.com',
  'aol.com',
]

/** Known slips, exact match on the domain. */
export const DOMAIN_TYPOS: Readonly<Record<string, string>> = {
  // icloud
  'icloiud.com': 'icloud.com', 'iclould.com': 'icloud.com', 'icoud.com': 'icloud.com', 'iclod.com': 'icloud.com',
  'icloud.co': 'icloud.com', 'icloud.con': 'icloud.com', 'icloud.cm': 'icloud.com', 'icloud.om': 'icloud.com', 'iclooud.com': 'icloud.com',
  // gmail
  'gamil.com': 'gmail.com', 'gmial.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmai.com': 'gmail.com',
  'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmaill.com': 'gmail.com', 'gmal.com': 'gmail.com',
  'gmail.cm': 'gmail.com', 'gmail.om': 'gmail.com', 'gmaail.com': 'gmail.com', 'gimail.com': 'gmail.com', 'googlemail.con': 'gmail.com',
  // hotmail
  'hotnail.com': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.con': 'hotmail.com',
  'hotmail.co': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'homail.com': 'hotmail.com',
  // yahoo
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahho.com': 'yahoo.com', 'yahoo.con': 'yahoo.com',
  'yahoo.co': 'yahoo.com', 'yhoo.com': 'yahoo.com', 'yaoo.com': 'yahoo.com',
  // outlook
  'outlok.com': 'outlook.com', 'outlool.com': 'outlook.com', 'outloook.com': 'outlook.com', 'outlook.con': 'outlook.com',
  'outlook.co': 'outlook.com', 'outook.com': 'outlook.com', 'otlook.com': 'outlook.com',
  // live / msn
  'live.con': 'live.com', 'msn.con': 'msn.com',
  // walla
  'wala.co.il': 'walla.co.il', 'walla.co.l': 'walla.co.il', 'walla.co.il.': 'walla.co.il', 'walla.coil': 'walla.co.il',
  'walla.co.ill': 'walla.co.il', 'walla.il': 'walla.co.il', 'wallla.co.il': 'walla.co.il', 'walla.com.il': 'walla.co.il',
}

/** Levenshtein distance, early-out above `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost)
      row.push(value)
      if (value < best) best = value
    }
    if (best > max) return max + 1
    prev = row
  }
  return prev[b.length]!
}

/**
 * The corrected address when the domain looks like a slip of a major
 * provider, else null. A trusted domain, or one that is not clearly closer to
 * exactly one trusted domain, gets no hint (so real domains like gmx.com are
 * left alone).
 */
export function suggestEmail(input: string): EmailSuggestion | null {
  const value = input.trim()
  const at = value.lastIndexOf('@')
  if (at < 1 || at === value.length - 1) return null
  const local = value.slice(0, at)
  const domain = value.slice(at + 1).toLowerCase()
  if (TRUSTED_DOMAINS.includes(domain)) return null

  const fixed = DOMAIN_TYPOS[domain]
  if (fixed) return { email: `${local}@${fixed}`, domain: fixed }

  // Fallback: one edit from exactly one trusted domain. Short names
  // (under 7 chars before the dot, e.g. "me", "msn", "aol") are skipped:
  // one edit there is too often a different real domain.
  const candidates = TRUSTED_DOMAINS.filter((trusted) => trusted.split('.')[0]!.length >= 5 && distance(domain, trusted, 1) === 1)
  if (candidates.length === 1) {
    const only = candidates[0]!
    return { email: `${local}@${only}`, domain: only }
  }
  return null
}
