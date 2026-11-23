import { describe, expect, it } from 'vitest'
import snapshot from '@/lib/inventory/raayonitCatalog.snapshot.json'
import categoryByKey from '@/lib/offers/raayonitCategoryByKey.json'
import { applyCanonical } from '@/lib/inventory/raayonitCanonicalCatalog'
import { isClosedText, isNamedClosure } from '@/lib/inventory/raayonitClosure'
import { brandOfRow, groupListing, isSuspended, type ListingRow } from '@/lib/inventory/raayonitListing'
import { finalizeCatalog } from '@/lib/inventory/raayonitSanitize'
import type { RaayonitBrand } from '@/lib/inventory/raayonitCatalog'
import { raayonitCategoryOf } from '@/lib/offers/raayonitCategories'

const finalized = finalizeCatalog(applyCanonical((snapshot as { brands: RaayonitBrand[] }).brands))
const byKey = categoryByKey as Record<string, string>
const row = (sid: string, sectionId: string, title: string): ListingRow => ({ rowId: sid, sid, sectionId, regionId: '1', title, address: 'תל אביב', phone: '03-1234567', website: '', kosher: false })

describe('closure wording', () => {
  it.each([
    'האתר לא מכבד תווים עד להודעה חדשה, עמכם הסליחה! - BROWN JLM SPA',
    'לאונרדו אין ים המלח - המלון סגור לרגל שיפוצים, עמכם הסליחה!',
    'לאונרדו ירושלים - האתר סגור באופן זמני, עמכם הסליחה!',
    'סניף דוגמה - סגור זמנית',
    'המלון סגור',
    'סגירה זמנית לשיפוצים',
  ])('flags %s', (text) => expect(isClosedText(text)).toBe(true))
  it.each(['לאונרדו פלאזה ירושלים', 'לאונרדו בוטיק ירושלים', 'ספא - לאונרדו פלאזה ירושלים', 'מלון סטאי כנרת', 'פסק זמן ספא'])('does not flag %s', (text) => {
    expect(isClosedText(text)).toBe(false)
    expect(isSuspended(text)).toBe(false)
  })
  it('excludes a named closure by its exact title only', () => {
    expect(isNamedClosure('לאונרדו ירושלים')).toBe(true)
    expect(isNamedClosure('לאונרדו פלאזה ירושלים')).toBe(false)
    expect(isNamedClosure('לאונרדו בוטיק ירושלים')).toBe(false)
  })
  it('drops the pane-only notice at grouping time', () => {
    const rows = [row('1', '78', 'מלון בדיקה')]
    const infos = new Map([['1', { image: '', notes: [], text: 'מלון בדיקה סגור לרגל שיפוצים' }]])
    expect(groupListing(rows, [], infos).brands).toEqual([])
  })
})

describe('mixed-category chains are split by listing section', () => {
  it('files a Leonardo hotel, a Leonardo spa and a U Hotels row under three different brands', () => {
    expect(brandOfRow(row('1', '78', 'לאונרדו פלאזה חיפה')).key).toBe('l-leonardo')
    expect(brandOfRow(row('2', '4', 'ספא - לאונרדו פלאזה ירושלים')).key).toBe('l-leonardo-spa')
    expect(brandOfRow(row('3', '4', 'לאונרדו קלאב טבריה')).key).toBe('l-leonardo-spa')
    expect(brandOfRow(row('4', '78', "יו מג'יק פאלאס אילת")).key).toBe('l-u-hotels')
  })
  it('keeps a hotel-named ShareSpa row in ShareSpa', () => {
    for (const title of ['דן כרמל חיפה - ShareSpa', 'הרודס הרצליה - ShareSpa', 'ניקס הרצליה - ShareSpa', 'לאונרדו גורדן ביץ תל אביב - ShareSpa']) expect(brandOfRow(row('5', '4', title)).key, title).toBe('l-sharespa')
  })
  it('groups a Leonardo hotel chain whatever order the rows come in', () => {
    const rows = [row('2', '4', 'ספא - לאונרדו פלאזה ירושלים'), row('1', '78', 'לאונרדו פלאזה חיפה')]
    const keys = (list: ListingRow[]) => groupListing(list, [], new Map()).brands.map((b) => `${b.key}:${b.category}`).sort()
    expect(keys(rows)).toEqual(keys([...rows].reverse()))
    expect(keys(rows)).toEqual(['l-leonardo-spa:Pampering Bundles', 'l-leonardo:Israel and Global Tourism'])
  })
  it('has no hotel chain in the spa category and no spa under hotels in the bundled catalogue', () => {
    const find = (re: RegExp) => finalized.find((b) => re.test(b.nameHe))!
    for (const name of [/^לאונרדו$/, /^BROWN$/, /^הרודס$/, /^VERT$/, /^NYX/, /^יו$/]) expect(find(name).category, String(name)).toBe('Israel and Global Tourism')
    for (const name of [/^ספא לאונרדו$/, /^ShareSpa$/]) expect(find(name).category, String(name)).toBe('Pampering Bundles')
  })
  it('resolves every hotel chain to the hotels rail and every Leonardo spa to the spa rail', () => {
    const cat = (b: RaayonitBrand) => raayonitCategoryOf({ sourceKey: `raayonit:${b.key}`, brandName: b.nameHe }, byKey)
    const find = (re: RegExp) => finalized.find((b) => re.test(b.nameHe))!
    for (const name of [/^לאונרדו$/, /^BROWN$/, /^הרודס$/, /^VERT$/, /^NYX/, /^יו$/]) expect(cat(find(name)), String(name)).toBe('hotels')
    for (const name of [/^ספא לאונרדו$/, /^ShareSpa$/]) expect(cat(find(name)), String(name)).toBe('spa')
  })
  it('has no Dan hotel chain: Dan appears only as ShareSpa branches', () => {
    expect(finalized.filter((b) => /^דן\b|\bDan\b/.test(b.nameHe) || /\bDan\b/.test(b.nameEn ?? ''))).toEqual([])
    expect(finalized.find((b) => b.nameHe === 'ShareSpa')!.branches.some((br) => /^דן /.test(br.name))).toBe(true)
  })
  it('never lists a closed branch or a branch twice across the catalogue', () => {
    const all = finalized.flatMap((b) => b.branches.map((br) => ({ brand: b.nameHe, name: br.name })))
    expect(all.filter((x) => isClosedText(x.name) || isNamedClosure(x.name))).toEqual([])
    const seen = new Map<string, string>()
    const dupes = all.filter((x) => /^(?:לאונרדו|יו |BROWN|הרודס|VERT)/.test(x.name)).filter((x) => { const had = seen.get(x.name); seen.set(x.name, x.brand); return had !== undefined && had !== x.brand })
    expect(dupes).toEqual([])
  })
})

describe('the sync stores the rail category from the brand name too', () => {
  it('files Brown (numeric key 227) under hotels, not Chains', () => {
    expect(raayonitCategoryOf({ sourceKey: 'raayonit:227', brandName: 'BROWN' }, byKey)).toBe('hotels')
    expect(raayonitCategoryOf({ sourceKey: 'raayonit:227' }, byKey)).toBe('networks')
    expect(raayonitCategoryOf({ sourceKey: 'raayonit:l-u-hotels', brandName: 'יו' }, byKey)).toBe('hotels')
  })
  it('passes the brand name when the sync writes the category', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('lib/inventory/raayonitCatalogSync.ts', 'utf8')).toMatch(/raayonitCategoryOf\(\{ sourceKey, brandName: brand\.nameHe \}/)
  })
})

describe('terms are translated with the issuer name protected', () => {
  it('sends Raayonit in Latin letters, never the Hebrew adjective', async () => {
    const { protectBrandWords } = await import('@/lib/inventory/raayonitCatalogSync')
    expect(protectBrandWords('ההזמנות יבוצעו דרך חברת רעיונית בלבד')).toBe('ההזמנות יבוצעו דרך חברת Raayonit בלבד')
    expect(protectBrandWords('ללא שם')).toBe('ללא שם')
  })
})
