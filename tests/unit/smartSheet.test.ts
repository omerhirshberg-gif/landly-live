import { describe, expect, it } from 'vitest'
import { parseSmartSheet } from '@/lib/inventory/smartSheet'

describe('smart Multipass sheet', () => {
  it('reads a consolidated sheet: every row names its perk, prices repeat', () => {
    const sheet = parseSmartSheet([
      ['Brand', 'Perk Name', 'Category', 'Retail Price', 'Member Price', 'Code', 'Expiry', 'PIN'],
      ['Fox', 'Gift card 100', 'Fashion and Shopping', 100, 90, 'A1', '2026-12-31', '1111'],
      ['Fox', 'Gift card 100', '', '', '', 'A2', '2026-12-31', ''],
      ['Castro', 'Gift card 200', 'Fashion and Shopping', '₪200', '₪180', 'B1', '31/12/2026', ''],
    ])
    expect(sheet.hasPerkColumns).toBe(true)
    expect(sheet.perks.map((p) => [p.brand, p.title, p.entries.length])).toEqual([['Fox', 'Gift card 100', 2], ['Castro', 'Gift card 200', 1]])
    expect(sheet.perks[0]).toMatchObject({ retailPrice: 100, memberPrice: 90, category: 'Fashion and Shopping' })
    expect(sheet.perks[0]!.entries[0]).toEqual({ code: 'A1', expiresAt: '2026-12-31', pin: '1111' })
    expect(sheet.perks[1]).toMatchObject({ retailPrice: 200, memberPrice: 180 })
    expect(sheet.perks[1]!.entries[0]!.expiresAt).toBe('2026-12-31')
  })

  it('reads a grouped sheet: a perk row with no code, then code-only rows', () => {
    const sheet = parseSmartSheet([
      ['שם הטבה', 'מותג', 'מחיר קמעונאי', 'מחיר חבר', 'קוד', 'תוקף', 'מספר סידורי'],
      ['שובר 100', 'פוקס', 100, 85, '', '2026-11-30', ''],
      ['', '', '', '', 'C1', '', 'p1'],
      ['', '', '', '', 'C2', '', ''],
      ['שובר 50', 'קסטרו', 50, '', '', '', ''],
      ['', '', '', '', 'D1', '2027-01-15', ''],
    ])
    expect(sheet.perks.map((p) => [p.title, p.brand, p.entries.map((e) => e.code)])).toEqual([['שובר 100', 'פוקס', ['C1', 'C2']], ['שובר 50', 'קסטרו', ['D1']]])
    expect(sheet.perks[0]).toMatchObject({ retailPrice: 100, memberPrice: 85 })
    expect(sheet.perks[0]!.entries[0]).toEqual({ code: 'C1', expiresAt: '2026-11-30', pin: 'p1' })
    expect(sheet.perks[1]).toMatchObject({ memberPrice: null })
    expect(sheet.perks[1]!.entries[0]!.expiresAt).toBe('2027-01-15')
  })

  it('groups by the identifier column when there is one, whatever the names say', () => {
    const sheet = parseSmartSheet([
      ['Perk Name', 'Barcode Identifier', 'Barcode'],
      ['Gift 100', 'X1', 'a'], ['Gift one hundred', 'X1', 'b'], ['Gift 100', 'X2', 'c'],
    ])
    expect(sheet.perks.map((p) => [p.key, p.entries.length])).toEqual([['id:x1', 2], ['id:x2', 1]])
  })

  it('treats a sheet with no perk columns as one plain code list', () => {
    const sheet = parseSmartSheet([['Barcode', 'Expiration Date'], ['Z1', '2026-10-20'], ['Z2', ''], ['Z1', '']])
    expect(sheet.hasPerkColumns).toBe(false)
    expect(sheet.perks).toHaveLength(1)
    expect(sheet.perks[0]!.key).toBe('')
    expect(sheet.perks[0]!.entries.map((e) => e.code)).toEqual(['Z1', 'Z2'])
    expect(sheet.duplicates).toBe(1)
  })

  it('counts duplicates across perks, bad dates, orphan codes and skips repeated headers and blanks', () => {
    const sheet = parseSmartSheet([
      ['Code', 'Perk Name', 'Expiry'],
      ['ORPHAN', '', ''],
      ['A', 'One', 'not a date'],
      ['A', 'Two', ''],
      ['Code', 'Perk Name', 'Expiry'],
      ['', '', ''],
      ['B', 'Two', ''],
    ])
    expect(sheet.problems.map((p) => p.reason).sort()).toEqual(['bad_date', 'duplicate', 'no_perk'])
    expect(sheet.badDates).toBe(1)
    expect(sheet.perks.map((p) => [p.title, p.entries.map((e) => e.code)])).toEqual([['One', ['A']], ['Two', ['B']]])
  })

  it('finds the header below a title banner, and without one reads column A as codes', () => {
    expect(parseSmartSheet([['Multipass export'], [''], ['קוד', 'תוקף'], ['K1', '2026-12-01']]).perks[0]!.entries[0]).toEqual({ code: 'K1', expiresAt: '2026-12-01', pin: null })
    expect(parseSmartSheet([['Q1'], ['Q2']]).headerFound).toBe(false)
  })
})
