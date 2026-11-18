import { describe, expect, it } from 'vitest'
import { maskCode, MAX_SHEET_ROWS, parseAmount, parseCodeSheet, validateSheetEntry } from '@/lib/inventory/parseCodeSheet'

describe('parseAmount', () => {
  it('reads whole shekel amounts however Excel wrote them', () => {
    for (const [raw, n] of [[100, 100], ['150', 150], ['100.00', 100], ['₪150', 150], ['150 ₪', 150], [' 100 ', 100]] as const) expect(parseAmount(raw), String(raw)).toBe(n)
  })
  it('rejects anything else', () => {
    for (const bad of ['', null, 'abc', '12.5', -5, 0, '1e3']) expect(parseAmount(bad), String(bad)).toBeNull()
  })
})

describe('parseCodeSheet (Raayonit: code and amount)', () => {
  it('reads the two Hebrew columns by their headings', () => {
    const sheet = parseCodeSheet([['קוד השובר', 'סכום השובר'], ['AAA-1', 100], ['AAA-2', '150']])
    expect(sheet.headerFound).toBe(true)
    expect(sheet.entries).toEqual([{ code: 'AAA-1', amount: 100 }, { code: 'AAA-2', amount: 150 }])
  })

  it('reads English headings in either order', () => {
    const sheet = parseCodeSheet([['Voucher Amount', 'Voucher Code'], [100, 'B-1']])
    expect(sheet.entries).toEqual([{ code: 'B-1', amount: 100 }])
  })

  it('uses column 1 as the code and column 2 as the amount when there is no heading', () => {
    const sheet = parseCodeSheet([['C-1', 100], ['C-2', 150]])
    expect(sheet.headerFound).toBe(false)
    expect(sheet.entries).toHaveLength(2)
  })

  it('keeps numeric cells as text codes and trims whitespace', () => {
    const sheet = parseCodeSheet([['code', 'amount'], [' 0012345 ', 100], [9876543210, 100]])
    expect(sheet.entries.map((e) => e.code)).toEqual(['0012345', '9876543210'])
  })

  it('counts duplicates, empty rows and rows without a valid amount, with their sheet row numbers', () => {
    const sheet = parseCodeSheet([['code', 'amount'], ['A', 100], ['A', 100], ['', ''], ['B', ''], ['C', 'x'], ['D', 150]])
    expect(sheet.entries.map((e) => e.code)).toEqual(['A', 'D'])
    expect(sheet.duplicates).toBe(1)
    expect(sheet.badAmounts).toBe(2)
    expect(sheet.problems.map((p) => [p.row, p.reason])).toEqual([[3, 'duplicate'], [5, 'bad_amount'], [6, 'bad_amount']])
  })

  it('caps the sheet at the upload limit and returns nothing for an empty one', () => {
    const big = Array.from({ length: MAX_SHEET_ROWS + 5 }, (_, i) => [`code-${i}`, 100])
    const sheet = parseCodeSheet([['code', 'amount'], ...big])
    expect(sheet.entries).toHaveLength(MAX_SHEET_ROWS)
    expect(sheet.tooMany).toBe(true)
    expect(parseCodeSheet([]).entries).toEqual([])
  })
})

describe('maskCode', () => {
  it('shows only the last four characters', () => {
    expect(maskCode('ABCDEFGH')).toBe('••••EFGH')
    expect(maskCode('AB')).toBe('••')
  })
})

describe('validateSheetEntry (the server never trusts the browser)', () => {
  it('accepts a well-formed row', () => {
    expect(validateSheetEntry({ code: ' X1 ', amount: '150' })).toEqual({ code: 'X1', amount: 150 })
  })
  it('rejects malformed rows', () => {
    for (const bad of [null, 'x', {}, { code: '', amount: 100 }, { code: 'A' }, { code: 'A', amount: 'free' }, { code: 'A'.repeat(300), amount: 100 }]) expect(validateSheetEntry(bad), JSON.stringify(bad)).toBeNull()
  })
})
