import { describe, expect, it } from 'vitest'
import { BATCH_COMMIT_CHUNK, MAX_BATCH_OFFERS, OFFER_TEMPLATE_COLUMNS, columnLetter, parseOffersSheet } from '@/lib/admin/offersBatch'

const lookup = (key: string) => (key === 'biz1' || key === '515123456' ? 'uid-1' : null)
const HEADER = [...OFFER_TEMPLATE_COLUMNS]
const row = (over: Partial<Record<(typeof OFFER_TEMPLATE_COLUMNS)[number], unknown>> = {}) => {
  const base: Record<string, unknown> = {
    title_he: 'ארוחת בוקר', title_en: 'Breakfast', businessId: 'biz1', category: 'Restaurants and Cafes', fulfillmentType: 'direct_merchant',
    originalPrice: 100, discountedPrice: 80, totalQuantity: 50, commissionRate: 10, paymentTerms: 'net_30', howToRedeem_he: '', imageUrl: '',
  }
  return HEADER.map((c) => ({ ...base, ...over })[c] ?? '')
}

describe('offers catalog sheet', () => {
  it('has the agreed template columns and limits', () => {
    expect(OFFER_TEMPLATE_COLUMNS).toEqual(['title_he', 'title_en', 'businessId', 'category', 'fulfillmentType', 'originalPrice', 'discountedPrice', 'totalQuantity', 'commissionRate', 'paymentTerms', 'howToRedeem_he', 'imageUrl', 'perkScope', 'brandName', 'participatingChains', 'isNationwide'])
    expect(MAX_BATCH_OFFERS).toBe(200)
    expect(BATCH_COMMIT_CHUNK).toBe(400)
  })

  it('accepts a good row and resolves the business by id or company number', () => {
    const a = parseOffersSheet([HEADER, row(), row({ businessId: '515123456' })], lookup)
    expect(a.rows.map((r) => r.errors)).toEqual([[], []])
    expect(a.rows[0]!.offer).toMatchObject({ businessUid: 'uid-1', offerPrice: 80, originalPrice: 100, totalQuantity: 50, commissionRate: 0.1, paymentTerms: 'net_30', fulfillmentType: 'direct_merchant' })
    expect(a.rows[0]!.row).toBe(2)
  })

  it('reads the optional isNationwide column: empty is a single location, Multipass is always multi-branch', () => {
    const sheet = parseOffersSheet([HEADER, row(), row({ isNationwide: 'yes' }), row({ isNationwide: 'כן' }), row({ isNationwide: 'no' }), row({ isNationwide: 'maybe' }), row({ fulfillmentType: 'multipass_pool', businessId: '', commissionRate: '', paymentTerms: '', brandName: 'Fox', isNationwide: 'no' })], lookup)
    expect(sheet.rows.map((r) => r.offer?.isNationwide)).toEqual([false, true, true, false, undefined, true])
    expect(sheet.rows[4]!.errors[0]).toMatchObject({ code: 'nationwide_invalid', cell: 'P6' })
  })

  it('reads participating stores: needs isNationwide on a local row, optional on Multipass', () => {
    const multi = { fulfillmentType: 'multipass_pool', businessId: '', commissionRate: '', paymentTerms: '', brandName: 'Fox' }
    const sheet = parseOffersSheet([HEADER, row({ participatingChains: 'Azrieli; Dizengoff Center' }), row({ isNationwide: 'yes', participatingChains: 'Azrieli; Dizengoff Center' }), row({ ...multi, perkScope: 'single_business', participatingChains: 'Azrieli' }), row({ ...multi, participatingChains: 'A; B' })], lookup)
    expect(sheet.rows[0]!.errors[0]).toMatchObject({ code: 'chains_need_nationwide', cell: 'O2' })
    expect(sheet.rows[1]!.offer).toMatchObject({ isNationwide: true, participatingChains: ['Azrieli', 'Dizengoff Center'] })
    expect(sheet.rows[2]!.offer).toMatchObject({ perkScope: 'single_business', participatingChains: ['Azrieli'] })
    expect(sheet.rows[3]!.offer).toMatchObject({ perkScope: 'multi_chain', participatingChains: ['A', 'B'] })
  })

  it('accepts a manual multi-chain pass on a local row: brand and chains, no business, no terms', () => {
    const pass = { perkScope: 'multi_chain', businessId: '', commissionRate: '', paymentTerms: '', brandName: 'BUYME All', category: 'Fashion and Shopping', participatingChains: 'FOX; Castro' }
    const sheet = parseOffersSheet([HEADER, row(pass), row({ ...pass, brandName: '' }), row({ ...pass, businessId: 'biz1' }), row({ ...pass, participatingChains: '' }), row({ ...pass, category: '' }), row({ ...pass, commissionRate: 10 }), row({ perkScope: 'nonsense' })], lookup)
    expect(sheet.rows[0]!.offer).toMatchObject({ fulfillmentType: 'direct_merchant', perkScope: 'multi_chain', brandName: 'BUYME All', businessUid: '', isNationwide: true, participatingChains: ['FOX', 'Castro'] })
    expect(sheet.rows.slice(1).map((r) => r.errors[0]?.code)).toEqual(['brand_required', 'multipass_business', 'chains_required', 'multipass_category', 'multipass_terms', 'scope_invalid'])
  })

  it('names the exact cell of every problem', () => {
    const sheet = parseOffersSheet([HEADER, row({ discountedPrice: 120 }), row({ businessId: 'nope' }), row({ title_he: '', title_en: '' }), row({ totalQuantity: 1.5 })], lookup)
    expect(sheet.rows.map((r) => r.errors.map((e) => `${e.cell}:${e.code}`))).toEqual([['G2:price_order'], ['C3:business_unknown'], ['A4:title_required'], ['H5:quantity_invalid']])
    expect(sheet.rows.every((r) => r.offer === null)).toBe(true)
  })

  it('reads Hebrew and short spellings of the channel, and ignores the quantity of a Multipass row', () => {
    const sheet = parseOffersSheet([HEADER, row({ fulfillmentType: 'מולטיפאס', totalQuantity: 9, businessId: '', commissionRate: '', paymentTerms: '', brandName: 'Fox Home' }), row({ fulfillmentType: 'direct' }), row({ fulfillmentType: 'x' })], lookup)
    expect(sheet.rows[0]!.offer).toMatchObject({ fulfillmentType: 'multipass_pool', totalQuantity: null })
    expect(sheet.rows[1]!.offer?.fulfillmentType).toBe('direct_merchant')
    expect(sheet.rows[2]!.errors[0]).toMatchObject({ code: 'fulfillment_invalid', cell: 'E4' })
  })

  it('takes a Multipass perk by brand, with no business, and keeps scope and chains apart', () => {
    const multi = { fulfillmentType: 'multipass_pool', businessId: '', commissionRate: '', paymentTerms: '', brandName: 'BUYME All Style' }
    const sheet = parseOffersSheet([HEADER, row({ ...multi, participatingChains: 'Fox; Castro; fox' }), row({ ...multi, perkScope: 'single_business', brandName: 'Fox Home' }), row({ ...multi, businessId: 'biz1' }), row({ ...multi, brandName: '' }), row({ ...multi, perkScope: 'multi_chain' }), row({ ...multi, category: '' }), row({ ...multi, commissionRate: 10 }), row({ brandName: 'Fox' })], lookup)
    expect(sheet.rows[0]!.offer).toMatchObject({ perkScope: 'multi_chain', brandName: 'BUYME All Style', participatingChains: ['Fox', 'Castro'], businessUid: '', fulfillmentType: 'multipass_pool' })
    expect(sheet.rows[1]!.offer).toMatchObject({ perkScope: 'single_business', brandName: 'Fox Home', participatingChains: [] })
    expect(sheet.rows.slice(2).map((r) => r.errors[0]?.code)).toEqual(['multipass_business', 'brand_required', 'chains_required', 'multipass_category', 'multipass_terms', 'direct_brand'])
  })

  it('accepts a sheet of Multipass perks that has no businessId column at all', () => {
    const cols = HEADER.filter((c) => c !== 'businessId')
    const line = cols.map((c) => ({ title_he: 'תו', title_en: '', category: 'Fashion and Shopping', fulfillmentType: 'multipass', originalPrice: 100, discountedPrice: 90, brandName: 'Fox Home' } as Record<string, unknown>)[c] ?? '')
    const sheet = parseOffersSheet([cols, line], lookup)
    expect(sheet.missingColumns).toEqual([])
    expect(sheet.rows[0]!.errors).toEqual([])
  })

  it('needs commission and payment terms together, and the same terms for one business', () => {
    const sheet = parseOffersSheet([HEADER, row({ paymentTerms: '' }), row({ commissionRate: 0.15, paymentTerms: '15' }), row({ commissionRate: 0.1, paymentTerms: 'net_30' }), row({ commissionRate: 0.2, paymentTerms: 'net_30' })], lookup)
    expect(sheet.rows[0]!.errors[0]!.code).toBe('terms_pair')
    expect(sheet.rows[1]!.offer).toMatchObject({ commissionRate: 0.15, paymentTerms: 'net_15' })
    expect(sheet.rows[2]!.errors[0]!.code).toBe('terms_conflict')
    expect(sheet.rows[3]!.errors[0]!.code).toBe('terms_conflict')
  })

  it('skips blank rows, caps the upload and reports missing columns', () => {
    expect(parseOffersSheet([HEADER, HEADER.map(() => ''), row()], lookup).rows).toHaveLength(1)
    const many = [HEADER, ...Array.from({ length: MAX_BATCH_OFFERS + 5 }, () => row())]
    const capped = parseOffersSheet(many, lookup)
    expect(capped.rows).toHaveLength(MAX_BATCH_OFFERS)
    expect(capped.tooMany).toBe(true)
    expect(parseOffersSheet([['foo', 'bar'], ['1', '2']], lookup).missingColumns.length).toBeGreaterThan(0)
  })

  it('reads the bilingual template header row', async () => {
    const he = ['כותרת בעברית', 'כותרת באנגלית', 'מזהה בית עסק', 'קטגוריה', 'ערוץ', 'מחיר מקורי', 'מחיר אחרי הנחה', 'כמות', 'עמלה', 'תנאי תשלום', 'הוראות מימוש', 'קישור לתמונה', 'סוג הטבה', 'שם המותג', 'רשתות מכבדות']
    const header = HEADER.map((c, i) => `${c} (${he[i]})`)
    expect(parseOffersSheet([header, row()], lookup).rows[0]!.errors).toEqual([])
    expect(parseOffersSheet([he, row()], lookup).rows[0]!.errors).toEqual([])
  })

  it('names spreadsheet columns past Z', () => {
    expect([0, 25, 26, 27].map(columnLetter)).toEqual(['A', 'Z', 'AA', 'AB'])
  })
})
