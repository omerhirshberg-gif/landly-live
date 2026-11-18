// Reads Raayonit's voucher spreadsheet into rows of code + face value. The file has two columns,
// "קוד השובר" (Voucher Code) and "סכום השובר" (Voucher Amount, 100 or 150), and no QR code.
// Pure: it takes the sheet as rows of cells (what SheetJS' `sheet_to_json` with `header: 1`
// returns), so the browser preview, the server's re-check and the unit tests all run the same
// rules. The file itself is only ever opened in the admin's browser (readCodeSheetFile.ts).

export const MAX_SHEET_ROWS = 2000
export const MAX_CODE_CHARS = 200
export const PREVIEW_ROWS = 5

export interface SheetEntry {
  code: string
  /** The voucher's face value in whole shekels (100 or 150). */
  amount: number
}

export interface SheetProblem {
  /** 1-based row number in the sheet, as the supplier's file shows it. */
  row: number
  reason: 'empty' | 'duplicate' | 'too_long' | 'bad_amount'
}

export interface ParsedSheet {
  entries: SheetEntry[]
  problems: SheetProblem[]
  duplicates: number
  empty: number
  /** Rows dropped because the amount is missing or not a positive whole number. */
  badAmounts: number
  headerFound: boolean
  tooMany: boolean
}

export const norm = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9֐-׿]+/g, '')

export const CODE_HEADERS = new Set(['code', 'vouchercode', 'couponcode', 'giftcode', 'קוד', 'קודשובר', 'קודהשובר', 'קודתו'])
export const AMOUNT_HEADERS = new Set(['amount', 'voucheramount', 'value', 'vouchervalue', 'סכום', 'סכוםשובר', 'סכוםהשובר', 'ערך', 'ערךהשובר', 'שווי'])

export const cellText = (value: unknown) => (value instanceof Date ? '' : String(value ?? '').trim())

/** "100", 100, "100.00", "₪150" or "150 ₪" to 100 / 150; null when it is not a positive whole number of shekels. */
export function parseAmount(value: unknown): number | null {
  const text = typeof value === 'number' ? String(value) : cellText(value).replace(/[₪\s,]|ש"ח|שח|nis|ils/gi, '')
  if (!/^\d{1,6}(\.0+)?$/.test(text)) return null
  const n = Number(text)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Rows of Raayonit's sheet to codes. Without a recognisable header row column 1 is the code and column 2 the amount. */
export function parseCodeSheet(matrix: readonly (readonly unknown[])[]): ParsedSheet {
  let header = -1
  let codeCol = 0
  let amountCol = 1
  for (let r = 0; r < Math.min(matrix.length, 10) && header < 0; r++) {
    const row = matrix[r] ?? []
    const code = row.findIndex((cell) => CODE_HEADERS.has(norm(cell)))
    if (code < 0) continue
    header = r
    codeCol = code
    const amount = row.findIndex((cell) => AMOUNT_HEADERS.has(norm(cell)))
    amountCol = amount >= 0 ? amount : code === 0 ? 1 : 0
  }
  const result: ParsedSheet = { entries: [], problems: [], duplicates: 0, empty: 0, badAmounts: 0, headerFound: header >= 0, tooMany: false }
  const seen = new Set<string>()
  for (let r = header + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? []
    if (row.every((cell) => cellText(cell) === '')) { result.empty++; continue }
    const code = cellText(row[codeCol])
    if (!code) { result.empty++; result.problems.push({ row: r + 1, reason: 'empty' }); continue }
    if (code.length > MAX_CODE_CHARS) { result.problems.push({ row: r + 1, reason: 'too_long' }); continue }
    if (seen.has(code)) { result.duplicates++; result.problems.push({ row: r + 1, reason: 'duplicate' }); continue }
    const amount = parseAmount(row[amountCol])
    if (amount === null) { result.badAmounts++; result.problems.push({ row: r + 1, reason: 'bad_amount' }); continue }
    seen.add(code)
    if (result.entries.length >= MAX_SHEET_ROWS) { result.tooMany = true; break }
    result.entries.push({ code, amount })
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
  const { code, amount } = value as Record<string, unknown>
  if (typeof code !== 'string' || !code.trim() || code.length > MAX_CODE_CHARS) return null
  const parsed = parseAmount(amount)
  return parsed === null ? null : { code: code.trim(), amount: parsed }
}
