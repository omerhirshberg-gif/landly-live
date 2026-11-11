// Reads a supplier's spreadsheet (a Multipass export) into voucher-code rows.
// Pure: it takes the sheet as rows of cells (what SheetJS' `sheet_to_json`
// with `header: 1` returns), so the browser preview, the server's re-check
// and the unit tests all run the same rules. The file itself is only ever
// opened in the admin's browser (lib/inventory/readCodeSheetFile.ts).

export const MAX_SHEET_ROWS = 2000
export const MAX_CODE_CHARS = 200
export const PREVIEW_ROWS = 5

export interface SheetEntry {
  code: string
  /** YYYY-MM-DD, or null when the row has none. */
  expiresAt: string | null
  pin: string | null
}

export interface SheetProblem {
  /** 1-based row number in the sheet, as the supplier's file shows it. */
  row: number
  reason: 'empty' | 'duplicate' | 'too_long' | 'bad_date'
}

export interface ParsedSheet {
  entries: SheetEntry[]
  problems: SheetProblem[]
  duplicates: number
  empty: number
  /** Rows kept although their expiry date could not be read. */
  badDates: number
  headerFound: boolean
  tooMany: boolean
}

export const norm = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9֐-׿]+/g, '')

export const CODE_HEADERS = new Set(['code', 'barcode', 'codebarcode', 'vouchercode', 'couponcode', 'giftcode', 'קוד', 'ברקוד', 'קודברקוד', 'קוד שובר'.replace(/\s/g, '')])
export const EXPIRY_HEADERS = new Set(['expirationdate', 'expirydate', 'expiry', 'expires', 'expiration', 'validuntil', 'validthru', 'תוקף', 'תאריךתוקף', 'תוקףעד'])
export const PIN_HEADERS = new Set(['serial', 'pin', 'serialpin', 'serialnumber', 'סריאלי', 'מספרסידורי', 'פין'])

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null
}

/** YYYY-MM-DD from a Date, an Excel serial, "2026-10-20", "20/10/2026" or "20.10.26"; null when it is none of these. */
export function parseSheetDate(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : iso(value.getFullYear(), value.getMonth() + 1, value.getDate())
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 20000 || value > 80000) return null
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000)
    return iso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  }
  const text = String(value ?? '').trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text)
  if (m) return iso(+m[1]!, +m[2]!, +m[3]!)
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/.exec(text)
  if (m) return iso(m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!, +m[2]!, +m[1]!)
  return null
}

export const cellText = (value: unknown) => (value instanceof Date ? '' : String(value ?? '').trim())

/** Rows of a supplier sheet to codes. Without a recognisable header row the first column is the code. */
export function parseCodeSheet(matrix: readonly (readonly unknown[])[]): ParsedSheet {
  let header = -1
  let codeCol = 0
  let expiryCol = -1
  let pinCol = -1
  for (let r = 0; r < Math.min(matrix.length, 10) && header < 0; r++) {
    const row = matrix[r] ?? []
    const found = row.findIndex((cell) => CODE_HEADERS.has(norm(cell)))
    if (found < 0) continue
    header = r
    codeCol = found
    expiryCol = row.findIndex((cell) => EXPIRY_HEADERS.has(norm(cell)))
    pinCol = row.findIndex((cell) => PIN_HEADERS.has(norm(cell)))
  }
  const result: ParsedSheet = { entries: [], problems: [], duplicates: 0, empty: 0, badDates: 0, headerFound: header >= 0, tooMany: false }
  const seen = new Set<string>()
  for (let r = header + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? []
    if (row.every((cell) => cellText(cell) === '' && !(cell instanceof Date))) { result.empty++; continue }
    const code = cellText(row[codeCol])
    if (!code) { result.empty++; result.problems.push({ row: r + 1, reason: 'empty' }); continue }
    if (code.length > MAX_CODE_CHARS) { result.problems.push({ row: r + 1, reason: 'too_long' }); continue }
    if (seen.has(code)) { result.duplicates++; result.problems.push({ row: r + 1, reason: 'duplicate' }); continue }
    seen.add(code)
    const rawExpiry = expiryCol >= 0 ? row[expiryCol] : null
    const hasExpiry = rawExpiry instanceof Date || cellText(rawExpiry) !== ''
    const expiresAt = hasExpiry ? parseSheetDate(rawExpiry) : null
    if (hasExpiry && !expiresAt) { result.badDates++; result.problems.push({ row: r + 1, reason: 'bad_date' }) }
    const pin = pinCol >= 0 ? cellText(row[pinCol]) : ''
    if (result.entries.length >= MAX_SHEET_ROWS) { result.tooMany = true; break }
    result.entries.push({ code, expiresAt, pin: pin || null })
  }
  return result
}

/** The first rows with all but the last 4 characters hidden: enough to check the right column was read. */
export function maskCode(code: string) {
  return code.length <= 4 ? '•'.repeat(code.length) : `${'•'.repeat(Math.min(code.length - 4, 12))}${code.slice(-4)}`
}

/** What the server accepts for one row, or null when it must be rejected. Never trusts the browser's parse. */
export function validateSheetEntry(value: unknown): SheetEntry | null {
  if (!value || typeof value !== 'object') return null
  const { code, expiresAt, pin } = value as Record<string, unknown>
  if (typeof code !== 'string' || !code.trim() || code.length > MAX_CODE_CHARS) return null
  if (pin != null && (typeof pin !== 'string' || pin.length > MAX_CODE_CHARS)) return null
  if (expiresAt != null && (typeof expiresAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt) || parseSheetDate(expiresAt) !== expiresAt)) return null
  return { code: code.trim(), expiresAt: (expiresAt as string | null | undefined) ?? null, pin: typeof pin === 'string' && pin.trim() ? pin.trim() : null }
}
