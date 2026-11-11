// A Multipass vendor sheet read as perks AND codes at once. Pure (rows of cells in, perks out),
// so the browser's review table, the server's re-check and the tests share one set of rules.
//
// Two shapes are understood:
//  - consolidated: every row names its perk (and usually repeats its prices) next to one code;
//  - grouped: a perk's row carries the details and no code, and the code-only rows under it belong to it.
// A sheet with no perk columns at all is a plain code list for one perk chosen elsewhere.

import { CODE_HEADERS, EXPIRY_HEADERS, MAX_CODE_CHARS, MAX_SHEET_ROWS, PIN_HEADERS, cellText, norm, parseSheetDate, type SheetEntry } from './parseCodeSheet'

export type SmartProblemReason = 'empty' | 'duplicate' | 'too_long' | 'bad_date' | 'no_perk'

export interface SmartProblem {
  /** 1-based row of the sheet, as the file shows it. */
  row: number
  reason: SmartProblemReason
}

export interface SmartPerk {
  /** Stable grouping key: the identifier column when present, else brand + title. '' for a plain code list. */
  key: string
  title: string
  brand: string
  category: string | null
  retailPrice: number | null
  memberPrice: number | null
  unitCost: number | null
  entries: SheetEntry[]
  /** 1-based sheet row where the perk first appears. */
  firstRow: number
}

export interface SmartSheet {
  perks: SmartPerk[]
  problems: SmartProblem[]
  duplicates: number
  empty: number
  badDates: number
  /** A header row with a code column was found. */
  headerFound: boolean
  /** The sheet names perks; false = a plain list of codes. */
  hasPerkColumns: boolean
  tooMany: boolean
}

const hn = (value: unknown) => norm(String(value ?? '').replace(/\([^)]*\)/g, ''))
const set = (...words: string[]) => new Set(words)

const PERK_HEADERS = set('perkname', 'perk', 'name', 'title', 'product', 'productname', 'offer', 'offername', 'שםהטבה', 'הטבה', 'שםמוצר', 'מוצר', 'שם', 'כותרת')
const BRAND_HEADERS = set('brand', 'brandname', 'merchant', 'chain', 'מותג', 'שםהמותג', 'רשת')
const ID_HEADERS = set('barcodeidentifier', 'identifier', 'perkid', 'productid', 'sku', 'itemid', 'מזהה', 'מזההטבה', 'מקט')
const CATEGORY_HEADERS = set('category', 'קטגוריה')
const RETAIL_HEADERS = set('retailprice', 'originalprice', 'listprice', 'facevalue', 'value', 'price', 'מחירקמעונאי', 'מחירמקורי', 'שווי', 'ערך', 'מחיר')
const MEMBER_HEADERS = set('memberprice', 'offerprice', 'saleprice', 'discountedprice', 'landlyprice', 'מחיראחריהנחה', 'מחירחבר', 'מחירמבצע')
const COST_HEADERS = set('unitcost', 'cost', 'wholesaleprice', 'purchaseprice', 'מחירעלות', 'עלות', 'מחירקנייה')

interface Columns { code: number; expiry: number; pin: number; perk: number; brand: number; id: number; category: number; retail: number; member: number; cost: number }

const find = (row: readonly unknown[], headers: Set<string>) => row.findIndex((cell) => headers.has(hn(cell)))

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null
  const cleaned = cellText(value).replace(/[₪,\s]/g, '')
  const n = cleaned === '' ? NaN : Number(cleaned)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Whether a cell looks like a header cell of this sheet (so a repeated header row inside the data is skipped). */
const isHeaderRepeat = (row: readonly unknown[], cols: Columns) => CODE_HEADERS.has(hn(row[cols.code]))

export function parseSmartSheet(matrix: readonly (readonly unknown[])[]): SmartSheet {
  let header = -1
  let cols: Columns = { code: 0, expiry: -1, pin: -1, perk: -1, brand: -1, id: -1, category: -1, retail: -1, member: -1, cost: -1 }
  for (let r = 0; r < Math.min(matrix.length, 10) && header < 0; r++) {
    const row = matrix[r] ?? []
    const code = row.findIndex((cell) => CODE_HEADERS.has(hn(cell)))
    if (code < 0) continue
    header = r
    cols = {
      code, expiry: row.findIndex((c) => EXPIRY_HEADERS.has(hn(c))), pin: row.findIndex((c) => PIN_HEADERS.has(hn(c))),
      perk: find(row, PERK_HEADERS), brand: find(row, BRAND_HEADERS), id: find(row, ID_HEADERS), category: find(row, CATEGORY_HEADERS),
      retail: find(row, RETAIL_HEADERS), member: find(row, MEMBER_HEADERS), cost: find(row, COST_HEADERS),
    }
  }
  const hasPerkColumns = cols.perk >= 0 || cols.brand >= 0 || cols.id >= 0
  const result: SmartSheet = { perks: [], problems: [], duplicates: 0, empty: 0, badDates: 0, headerFound: header >= 0, hasPerkColumns, tooMany: false }
  const byKey = new Map<string, SmartPerk>()
  const seenCodes = new Set<string>()
  let current: SmartPerk | null = null
  let currentExpiry: string | null = null
  let codeCount = 0

  const perkFor = (key: string, row: readonly unknown[], rowNumber: number): SmartPerk => {
    let perk = byKey.get(key)
    if (!perk) {
      const title = cellText(row[cols.perk]) || cellText(row[cols.brand]) || cellText(row[cols.id])
      perk = { key, title, brand: cellText(row[cols.brand]), category: null, retailPrice: null, memberPrice: null, unitCost: null, entries: [], firstRow: rowNumber }
      byKey.set(key, perk)
      result.perks.push(perk)
    }
    // The first value seen for a detail wins, so a perk's rows may repeat or leave them blank.
    const text = (col: number) => (col >= 0 ? cellText(row[col]) : '')
    if (!perk.category && text(cols.category)) perk.category = text(cols.category)
    if (perk.retailPrice === null && cols.retail >= 0) perk.retailPrice = toNumber(row[cols.retail])
    if (perk.memberPrice === null && cols.member >= 0) perk.memberPrice = toNumber(row[cols.member])
    if (perk.unitCost === null && cols.cost >= 0) perk.unitCost = toNumber(row[cols.cost])
    if (!perk.brand && text(cols.brand)) perk.brand = text(cols.brand)
    return perk
  }

  for (let r = header + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? []
    const rowNumber = r + 1
    if (row.every((cell) => cellText(cell) === '' && !(cell instanceof Date))) { result.empty++; continue }
    if (isHeaderRepeat(row, cols)) continue
    const code = cellText(row[cols.code])
    const title = cols.perk >= 0 ? cellText(row[cols.perk]) : ''
    const brand = cols.brand >= 0 ? cellText(row[cols.brand]) : ''
    const id = cols.id >= 0 ? cellText(row[cols.id]) : ''
    const names = !!(title || brand || id)
    const rawExpiry = cols.expiry >= 0 ? row[cols.expiry] : null
    const hasExpiry = rawExpiry instanceof Date || cellText(rawExpiry) !== ''
    const rowExpiry = hasExpiry ? parseSheetDate(rawExpiry) : null

    if (names) {
      const key = id ? `id:${norm(id)}` : `${norm(brand)}|${norm(title)}`
      const known = byKey.has(key)
      current = perkFor(key, row, rowNumber)
      if (!known || !code) currentExpiry = rowExpiry
      if (!code) continue // a grouped sheet's perk row: details only
    } else if (!code) {
      result.empty++
      result.problems.push({ row: rowNumber, reason: 'empty' })
      continue
    } else if (hasPerkColumns) {
      if (!current) { result.problems.push({ row: rowNumber, reason: 'no_perk' }); continue }
    } else {
      current ??= perkFor('', [], rowNumber)
    }
    const perk = current!

    if (code.length > MAX_CODE_CHARS) { result.problems.push({ row: rowNumber, reason: 'too_long' }); continue }
    if (seenCodes.has(code)) { result.duplicates++; result.problems.push({ row: rowNumber, reason: 'duplicate' }); continue }
    if (codeCount >= MAX_SHEET_ROWS) { result.tooMany = true; break }
    seenCodes.add(code)
    codeCount++
    if (hasExpiry && !rowExpiry) { result.badDates++; result.problems.push({ row: rowNumber, reason: 'bad_date' }) }
    const pin = cols.pin >= 0 ? cellText(row[cols.pin]) : ''
    perk.entries.push({ code, expiresAt: hasExpiry ? rowExpiry : names ? rowExpiry : currentExpiry, pin: pin || null })
  }
  // A perk row with no codes under it has nothing to import.
  result.perks = result.perks.filter((p) => p.entries.length > 0)
  return result
}

/** Normalised text for matching a sheet's perk against stored offers. */
export const matchText = (value: unknown) => norm(value)
