import { describe, expect, it } from 'vitest'
import snapshot from '@/lib/inventory/raayonitCatalog.snapshot.json'
import { applyCanonical, BLANK_PHONE_BRANCHES, EXPECTED_BRANCH_COUNTS } from '@/lib/inventory/raayonitCanonicalCatalog'
import { finalizeCatalog, isJunkText } from '@/lib/inventory/raayonitSanitize'
import { officialBrandName } from '@/lib/inventory/raayonitBrandNames'
import type { RaayonitBrand } from '@/lib/inventory/raayonitCatalog'

const brands = finalizeCatalog(applyCanonical((snapshot as { brands: RaayonitBrand[] }).brands))
const find = (re: RegExp) => brands.find((b) => re.test(b.nameHe) || (!!b.nameEn && re.test(b.nameEn)))

describe('canonical Raayonit catalogue', () => {
  it('has no suspended brand, closed branch or junk text', () => {
    expect(find(/ספא במלונות בראון/)).toBeUndefined()
    const names = brands.flatMap((b) => b.branches.map((x) => `${x.name} ${x.address}`))
    expect(names.filter((n) => isJunkText(n) || /האפרסק 20|לאונרדו אין ים המלח/.test(n))).toEqual([])
    expect(find(/קפה רוסטרס/)!.branches.map((b) => b.address).join('|')).not.toMatch(/האפרסק/)
  })
  it.each(EXPECTED_BRANCH_COUNTS)('%s has %i active branches', (_n, re, count) => {
    expect(find(re)?.branches.length).toBe(count)
  })
  it('lists U Hotels with the official phones', () => {
    const u = find(/^יו$/)!
    expect(u.category).toBe('Israel and Global Tourism')
    expect(u.branches.map((b) => b.phone)).toEqual(['03-5110050', '03-5110000', '03-5110050'])
    expect(officialBrandName('יו', 'en')).toBe('U Hotels')
  })
  it('names Tilia a therapeutic clinic, with one phone on its four branches', () => {
    const t = find(/טיליה/)!
    expect(t.nameHe).toBe('טיליה - קליניקה טיפולית')
    expect(new Set(t.branches.map((b) => b.phone))).toEqual(new Set(['072-2500493']))
  })
  it('keeps Brown Mahane Yehuda inside Brown Hotels', () => {
    const b = find(/^BROWN$/)!
    expect(b.category).toBe('Israel and Global Tourism')
    expect(b.branches.some((x) => /מחנה יהודה/.test(x.name))).toBe(true)
  })
  it('leaves blank phones blank rather than inventing them', () => {
    for (const name of BLANK_PHONE_BRANCHES) {
      const rows = brands.flatMap((b) => b.branches).filter((x) => x.name.includes(name))
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.every((r) => r.phone === '')).toBe(true)
    }
  })
  it('has an official name in every language for every brand', () => {
    expect(brands.filter((b) => officialBrandName(b.nameHe, 'en') === null).map((b) => b.nameHe)).toEqual([])
  })
})

describe('Leonardo', () => {
  it('keeps the active Jerusalem spa and drops the closed ones', () => {
    const rows = find(/^לאונרדו$/)!.branches.map((b) => b.name)
    expect(rows).toContain('ספא - לאונרדו פלאזה ירושלים')
    expect(rows.join('|')).not.toMatch(/אין ים המלח/)
  })
})
