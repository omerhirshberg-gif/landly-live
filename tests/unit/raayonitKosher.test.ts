import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sanitizeBranches } from '@/lib/inventory/raayonitSanitize'
import { applyListingKosher, type ListingRow } from '@/lib/inventory/raayonitListing'
import { KOSHER_SUFFIX, planKosherFix } from '@/lib/inventory/raayonitKosherFix'
import { branchLabel, type RaayonitBrand } from '@/lib/inventory/raayonitCatalog'
import { bundledCatalog } from '@/lib/inventory/raayonitCatalogSync'
import { finalizeCatalog } from '@/lib/inventory/raayonitSanitize'

const branch = (name: string, address: string, kosher?: boolean, phone = '') => ({ name, address, phone, ...(kosher === undefined ? {} : { kosher }) })
const brand = (nameHe: string, branches: ReturnType<typeof branch>[], key = '151'): RaayonitBrand => ({ key, nameHe, nameEn: '', category: 'Restaurants and Cafes', logoUrl: '', siteUrl: '', restrictions: [], methods: ['in_store'], branches })
const row = (sid: string, title: string, address: string, kosher: boolean): ListingRow => ({ rowId: `r${sid}`, sid, sectionId: '15', regionId: '1', title, address, phone: '', website: '', kosher })

describe('sanitizeBranches keeps a kosher flag from a duplicate', () => {
  it('the first copy takes kosher: true from a later copy, in either order', () => {
    expect(sanitizeBranches([branch('סניף', 'הרצל 1'), branch('סניף', 'הרצל 1', true)])).toEqual([branch('סניף', 'הרצל 1', true)])
    expect(sanitizeBranches([branch('סניף', 'הרצל 1', true), branch('סניף', 'הרצל 1')])).toEqual([branch('סניף', 'הרצל 1', true)])
  })
  it('keeps a false or absent flag as it is and keeps the first copy\'s phone', () => {
    expect(sanitizeBranches([branch('סניף', 'הרצל 1', false, '03-1'), branch('סניף', 'הרצל 1', false, '03-2')])).toEqual([branch('סניף', 'הרצל 1', false, '03-1')])
    expect(sanitizeBranches([branch('סניף', 'הרצל 1'), branch('סניף', 'הרצל 1')])[0]!.kosher).toBeUndefined()
  })
})

describe('applyListingKosher', () => {
  const mex = brand('MEXICANA', [branch('ראשונים', 'קניון ראשונים, ראשון לציון'), branch('שרונה', 'שרונה מרקט, תל אביב'), branch('דיזנגוף', 'דיזנגוף 5, תל אביב')])
  const rows = [row('1', 'MEXICANA ראשונים', 'קניון ראשונים, ראשון לציון', true), row('2', 'MEXICANA שרונה', 'שרונה מרקט, תל אביב', true), row('3', 'MEXICANA דיזנגוף', 'דיזנגוף 5, תל אביב', false)]
  it('flags only the branches the listing marks kosher and leaves every other field alone', () => {
    const [out] = applyListingKosher([mex], rows)
    expect(out!.branches.map((b) => b.kosher)).toEqual([true, true, undefined])
    expect(out!.branches[0]).toMatchObject({ name: 'ראשונים', phone: '' })
  })
  it('is idempotent and returns the same brand object when nothing changes', () => {
    const once = applyListingKosher([mex], rows)
    expect(applyListingKosher(once, rows)[0]).toBe(once[0])
    expect(applyListingKosher([mex], [row('3', 'MEXICANA דיזנגוף', 'דיזנגוף 5, תל אביב', false)])[0]).toBe(mex)
  })
  it('does not flag another business at the same mall address', () => {
    const other = brand('ALDO', [branch('קניון', 'קניון ראשונים, ראשון לציון')], '254')
    expect(applyListingKosher([other], rows)[0]).toBe(other)
  })
  it('ignores a suspended row', () => {
    expect(applyListingKosher([mex], [row('1', 'MEXICANA ראשונים - האתר לא מכבד תווים עד להודעה חדשה', 'קניון ראשונים, ראשון לציון', true)])[0]).toBe(mex)
  })
})

describe('planKosherFix', () => {
  const live = brand('MEXICANA', [{ ...branch('ראשונים', 'קניון ראשונים, ראשון לציון'), kosher: true }, branch('דיזנגוף', 'דיזנגוף 5, תל אביב')])
  const card = () => ({
    branches: [{ name: 'ראשונים', address: 'קניון ראשונים, ראשון לציון', phone: '03-1', kosher: false, city: 'x', i18n: { en: { name: 'Rishonim', city: '', address: '' } } }, { name: 'דיזנגוף', address: 'דיזנגוף 5, תל אביב', phone: '', kosher: false }],
    participatingChains: [branchLabel(branch('ראשונים', 'קניון ראשונים, ראשון לציון')), branchLabel(branch('דיזנגוף', 'דיזנגוף 5, תל אביב'))], kosherBranchCount: 0,
  })
  it('turns on the kosher flag, the count and the chains suffix, keeping every other field (phones stay as stored, even empty)', () => {
    const fix = planKosherFix(card(), live)!
    expect(fix.flagged).toBe(1)
    expect(fix.kosherBranchCount).toBe(1)
    expect(fix.branches[0]).toMatchObject({ kosher: true, phone: '03-1', i18n: { en: { name: 'Rishonim' } } })
    expect(fix.branches[1]).toMatchObject({ kosher: false, phone: '' })
    expect(fix.participatingChains[0]!.endsWith(KOSHER_SUFFIX)).toBe(true)
    expect(fix.participatingChains[1]!.endsWith(KOSHER_SUFFIX)).toBe(false)
  })
  it('never turns a kosher branch off, and is a no-op once applied', () => {
    const c = card(); c.branches[1]!.kosher = true
    expect(planKosherFix(c, live)!.branches[1]!.kosher).toBe(true)
    const fix = planKosherFix(card(), live)!
    expect(planKosherFix({ branches: fix.branches, participatingChains: fix.participatingChains, kosherBranchCount: fix.kosherBranchCount }, live)).toBeNull()
  })
  it('skips a card with no stored branches', () => {
    expect(planKosherFix({ branches: [] }, live)).toBeNull()
    expect(planKosherFix({}, live)).toBeNull()
  })
})

describe('the bundled catalogue after the patch', () => {
  const brands = new Map(finalizeCatalog(bundledCatalog()).map((b) => [b.key, b]))
  const kosher = (key: string) => brands.get(key)!.branches.filter((b) => b.kosher).length
  it('carries the kosher branches of the 12 cards, partial ones included', () => {
    expect([kosher('232'), kosher('183'), kosher('209'), kosher('189'), kosher('25'), kosher('231'), kosher('151'), kosher('177'), kosher('22'), kosher('149'), kosher('98')]).toEqual([48, 12, 13, 9, 25, 14, 4, 2, 1, 1, 1])
    expect(kosher('216')).toBeGreaterThanOrEqual(6)
  })
})

describe('the kosher count chip renders its number isolated LTR', () => {
  it('web wraps it in <bdi dir="ltr"> and native in an LTR isolate', () => {
    expect(readFileSync(new URL('../../app/offers/[offerId]/page.tsx', import.meta.url), 'utf8')).toContain('<bdi key={i} dir="ltr">{offer.kosherBranchCount}</bdi>')
    expect(readFileSync(new URL('../../landly-mobile/src/app/offer/[offerId].tsx', import.meta.url), 'utf8')).toContain("isolateLtr(String(offer.kosherBranchCount))")
  })
})

describe('the DEV fix script', () => {
  const src = readFileSync(new URL('../../scripts/fix-raayonit-kosher-dev.mts', import.meta.url), 'utf8')
  it('refuses any project but landly-dev, supports --dry, writes only the kosher fields and imports no translator', () => {
    expect(src).toContain("projectId !== 'landly-dev'")
    expect(src).toContain("args.includes('--dry')")
    expect(src).toContain('data: { branches: fix.branches, kosherBranchCount: fix.kosherBranchCount, participatingChains: fix.participatingChains }')
    expect(src).not.toMatch(/^import .*(translat|Translate)/im)
    expect(src).not.toContain('landly-be752')
  })
})
