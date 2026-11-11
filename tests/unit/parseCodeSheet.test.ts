import { describe, expect, it } from 'vitest'
import { maskCode, MAX_SHEET_ROWS, parseCodeSheet, parseSheetDate, validateSheetEntry } from '@/lib/inventory/parseCodeSheet'

describe('parseSheetDate', () => {
  it('reads ISO, Israeli day-first, Excel serial and Date cells', () => {
    expect(parseSheetDate('2026-10-20')).toBe('2026-10-20')
    expect(parseSheetDate('20/10/2026')).toBe('2026-10-20')
    expect(parseSheetDate('20.10.26')).toBe('2026-10-20')
    expect(parseSheetDate('1-2-2027')).toBe('2027-02-01')
    expect(parseSheetDate(46315)).toBe('2026-10-20') // Excel serial
    expect(parseSheetDate(new Date(2026, 9, 20))).toBe('2026-10-20')
  })
  it('rejects impossible and unreadable dates', () => {
    for (const bad of ['31/02/2026', '2026-13-01', 'soon', '', null, 12, new Date('x')]) expect(parseSheetDate(bad), String(bad)).toBeNull()
  })
})

describe('parseCodeSheet', () => {
  const header = ['Code / Barcode', 'Expiration Date', 'Serial / PIN']

  it('maps the supplier columns by their headings, wherever they sit', () => {
    const sheet = parseCodeSheet([
      ['Multipass export'],
      ['Serial / PIN', 'Code / Barcode', 'Expiration Date'],
      ['1111', 'AAA-1', '20/10/2026'],
      ['2222', 'AAA-2', ''],
    ])
    expect(sheet.headerFound).toBe(true)
    expect(sheet.entries).toEqual([
      { code: 'AAA-1', expiresAt: '2026-10-20', pin: '1111' },
      { code: 'AAA-2', expiresAt: null, pin: '2222' },
    ])
  })

  it('accepts Hebrew and alternative headings', () => {
    const sheet = parseCodeSheet([['ברקוד', 'תוקף'], ['B1', '2026-12-31']])
    expect(sheet.entries).toEqual([{ code: 'B1', expiresAt: '2026-12-31', pin: null }])
    expect(parseCodeSheet([['Barcode'], ['X']]).entries).toHaveLength(1)
  })

  it('uses the first column when there is no recognisable heading, and says so', () => {
    const sheet = parseCodeSheet([['C1'], ['C2']])
    expect(sheet.headerFound).toBe(false)
    expect(sheet.entries.map((e) => e.code)).toEqual(['C1', 'C2'])
  })

  it('counts duplicates and empty rows, with their sheet row numbers', () => {
    const sheet = parseCodeSheet([header, ['A', '', ''], ['A', '', ''], ['', '', ''], [null, null, null], ['B', '', '']])
    expect(sheet.entries.map((e) => e.code)).toEqual(['A', 'B'])
    expect(sheet.duplicates).toBe(1)
    expect(sheet.empty).toBe(2)
    expect(sheet.problems).toContainEqual({ row: 3, reason: 'duplicate' })
  })

  it('keeps a row whose date is unreadable but reports it', () => {
    const sheet = parseCodeSheet([header, ['A', 'next week', '']])
    expect(sheet.entries).toEqual([{ code: 'A', expiresAt: null, pin: null }])
    expect(sheet.badDates).toBe(1)
  })

  it('keeps numeric cells as text and trims whitespace', () => {
    const sheet = parseCodeSheet([header, [' 0012345 ', '', ''], [987654321, '', '']])
    expect(sheet.entries.map((e) => e.code)).toEqual(['0012345', '987654321'])
  })

  it('drops oversize codes and caps the sheet at the upload limit', () => {
    expect(parseCodeSheet([header, ['x'.repeat(201), '', '']]).entries).toHaveLength(0)
    const rows = Array.from({ length: MAX_SHEET_ROWS + 5 }, (_, i) => [`C${i}`, '', ''])
    const big = parseCodeSheet([header, ...rows])
    expect(big.entries).toHaveLength(MAX_SHEET_ROWS)
    expect(big.tooMany).toBe(true)
  })

  it('returns nothing for an empty sheet', () => {
    expect(parseCodeSheet([]).entries).toEqual([])
    expect(parseCodeSheet([header]).entries).toEqual([])
  })
})

describe('maskCode', () => {
  it('shows only the last four characters', () => {
    expect(maskCode('ABCD-1234-5678')).toMatch(/^•+5678$/)
    expect(maskCode('abc')).toBe('•••')
    expect(maskCode('ABCD-1234-5678')).not.toContain('ABCD')
  })
})

describe('validateSheetEntry (the server never trusts the browser)', () => {
  it('accepts a well-formed row', () => {
    expect(validateSheetEntry({ code: ' A1 ', expiresAt: '2026-10-20', pin: ' 99 ' })).toEqual({ code: 'A1', expiresAt: '2026-10-20', pin: '99' })
    expect(validateSheetEntry({ code: 'A1' })).toEqual({ code: 'A1', expiresAt: null, pin: null })
  })
  it('rejects malformed rows', () => {
    for (const bad of [null, 'A1', {}, { code: '' }, { code: 5 }, { code: 'x'.repeat(201) }, { code: 'A', expiresAt: '20/10/2026' }, { code: 'A', expiresAt: '2026-02-31' }, { code: 'A', pin: 7 }]) {
      expect(validateSheetEntry(bad), JSON.stringify(bad)).toBeNull()
    }
  })
})
