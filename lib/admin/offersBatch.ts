// The offers catalog spreadsheet (landly_offers_template.xlsx): the columns, and the
// rules each row must pass. Pure, so the browser's preview, the server's re-check
// and the unit tests all run the same code. The server never trusts the browser's result.

import { BUSINESS_CATEGORIES } from '@/lib/categories'
import { isCommissionRate, isPaymentTerms, type PaymentTerms } from '@/lib/merchants/terms'
import { MAX_REDEMPTION_INSTRUCTIONS_LENGTH } from '@/lib/offers/redemption'
import { imageUrlProblem, normalizeImageUrl } from '@/lib/offers/imageUrl'
import { isValidImageUrl } from '@/lib/admin/validateImageUrl'
import { validateOfferPrices } from '@/lib/admin/validateOfferPrices'
import type { FulfillmentType } from '@/lib/inventory/types'
import { normalizeChains, parsePerkScopeFields, type PerkScope } from '@/lib/offers/perkScope'

export const OFFER_TEMPLATE_COLUMNS = [
  'title_he', 'title_en', 'businessId', 'category', 'fulfillmentType', 'originalPrice', 'discountedPrice',
  'totalQuantity', 'commissionRate', 'paymentTerms', 'howToRedeem_he', 'imageUrl', 'perkScope', 'brandName', 'participatingChains',
] as const
export type OfferColumn = (typeof OFFER_TEMPLATE_COLUMNS)[number]

/** One upload creates at most this many offers. */
export const MAX_BATCH_OFFERS = 200
/** Firestore commits at most 500 writes; each commit here holds this many offers, all or nothing. */
export const BATCH_COMMIT_CHUNK = 400
export const MAX_TITLE_LENGTH = 200

export type BatchErrorCode =
  | 'title_required' | 'title_long' | 'business_required' | 'business_unknown' | 'category_invalid' | 'fulfillment_invalid'
  | 'original_invalid' | 'discounted_invalid' | 'price_order' | 'quantity_invalid' | 'commission_invalid'
  | 'payment_terms_invalid' | 'terms_pair' | 'terms_conflict' | 'redeem_long' | 'image_invalid'
  | 'brand_required' | 'brand_long' | 'scope_invalid' | 'chains_required' | 'multipass_business' | 'direct_brand' | 'multipass_terms' | 'multipass_category'

export interface BatchCellError {
  column: OfferColumn
  code: BatchErrorCode
  /** The spreadsheet cell, e.g. "F7". */
  cell: string
}

export interface BatchOffer {
  titleHe: string
  titleEn: string
  /** The business's document id once resolved (see `lookup`); empty for a Multipass perk, which has a brand instead. */
  businessUid: string
  perkScope: PerkScope
  brandName: string
  participatingChains: string[]
  category: string | null
  fulfillmentType: FulfillmentType
  originalPrice: number
  offerPrice: number
  totalQuantity: number | null
  commissionRate: number | null
  paymentTerms: PaymentTerms | null
  redemptionInstructions: string
  imageUrl: string
}

export interface BatchRow {
  /** 1-based row of the sheet, as the file shows it. */
  row: number
  title: string
  businessKey: string
  offer: BatchOffer | null
  errors: BatchCellError[]
}

export interface ParsedOffersSheet {
  rows: BatchRow[]
  missingColumns: OfferColumn[]
  tooMany: boolean
}

/** A header cell with any "(label)" after the column name dropped, so "title_he (כותרת בעברית)" is title_he. */
const headerNorm = (value: unknown) => norm(String(value ?? '').replace(/\([^)]*\)/g, ''))
const norm = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9֐-׿]+/g, '')

const ALIASES: Record<OfferColumn, string[]> = {
  title_he: ['titlehe', 'titlehebrew', 'כותרת', 'כותרתעברית', 'כותרתבעברית'],
  title_en: ['titleen', 'titleenglish', 'כותרתאנגלית', 'כותרתבאנגלית'],
  businessId: ['businessid', 'business', 'businessuid', 'מזההעסק', 'מזההביתעסק', 'עסק'],
  category: ['category', 'קטגוריה'],
  fulfillmentType: ['fulfillmenttype', 'fulfillment', 'channel', 'ערוץ'],
  originalPrice: ['originalprice', 'price', 'מחירמקורי'],
  discountedPrice: ['discountedprice', 'offerprice', 'saleprice', 'מחירמבצע', 'מחיראחריהנחה'],
  totalQuantity: ['totalquantity', 'quantity', 'כמות'],
  commissionRate: ['commissionrate', 'commission', 'עמלה'],
  paymentTerms: ['paymentterms', 'תנאיתשלום'],
  howToRedeem_he: ['howtoredeemhe', 'howtoredeem', 'redemptioninstructions', 'הוראותמימוש'],
  imageUrl: ['imageurl', 'image', 'תמונה', 'קישורלתמונה'],
  perkScope: ['perkscope', 'scope', 'סוגהטבה', 'סוגמולטיפאס'],
  brandName: ['brandname', 'brand', 'שםהמותג', 'מותג'],
  participatingChains: ['participatingchains', 'chains', 'רשתותמכבדות', 'רשתות'],
}

/** "A".."Z", "AA".. for a 0-based column index. */
export function columnLetter(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

const text = (value: unknown) => (value instanceof Date ? '' : String(value ?? '').trim())

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  const cleaned = text(value).replace(/[₪,\s]/g, '').replace(/%$/, '')
  return cleaned === '' ? NaN : Number(cleaned)
}

const SCOPE_ALIASES: Record<string, PerkScope> = {
  singlebusiness: 'single_business', single: 'single_business', singlebrand: 'single_business', מותגבודד: 'single_business', רשתבודדת: 'single_business',
  multichain: 'multi_chain', multi: 'multi_chain', תורבךשתי: 'multi_chain', תורברשתי: 'multi_chain', רברשתי: 'multi_chain',
}

const FULFILLMENT_ALIASES: Record<string, FulfillmentType> = {
  directmerchant: 'direct_merchant', direct: 'direct_merchant', עסקמקומיישיר: 'direct_merchant', עסקמקומי: 'direct_merchant', ישיר: 'direct_merchant',
  multipasspool: 'multipass_pool', multipass: 'multipass_pool', מולטיפאס: 'multipass_pool', הטבתמולטיפאס: 'multipass_pool',
}

function parsePaymentTerms(raw: string): PaymentTerms | null {
  const key = norm(raw)
  if (key === 'immediate' || key === 'immediately' || key === '0') return 'net_0'
  const days = /^(?:net)?(\d+)(?:days)?$/.exec(key)
  const candidate = days ? `net_${Number(days[1])}` : raw.trim().toLowerCase().replace(/\s+/g, '_')
  return isPaymentTerms(candidate) ? candidate : null
}

export type BusinessLookup = (key: string) => string | null

/**
 * Rows of the sheet to offers. `lookup` turns a row's businessId (a business's id or its
 * company number) into the business's document id, or null when there is none.
 * A sheet whose header row lacks a required column is reported as missing columns, with no rows.
 */
export function parseOffersSheet(matrix: readonly (readonly unknown[])[], lookup: BusinessLookup): ParsedOffersSheet {
  const result: ParsedOffersSheet = { rows: [], missingColumns: [], tooMany: false }
  let header = -1
  const cols = {} as Record<OfferColumn, number>
  for (let r = 0; r < Math.min(matrix.length, 10) && header < 0; r++) {
    const row = matrix[r] ?? []
    const found = {} as Record<OfferColumn, number>
    for (const column of OFFER_TEMPLATE_COLUMNS) found[column] = row.findIndex((cell) => ALIASES[column].includes(headerNorm(cell)))
    if ((found.businessId >= 0 || found.brandName >= 0) && found.originalPrice >= 0) {
      header = r
      Object.assign(cols, found)
    }
  }
  if (header < 0) {
    result.missingColumns = ['businessId', 'originalPrice', 'discountedPrice']
    return result
  }
  // businessId is only for local-business rows, so a sheet of Multipass perks may leave the column out.
  result.missingColumns = (['businessId', 'originalPrice', 'discountedPrice'] as const).filter((column) => cols[column] < 0 && !(column === 'businessId' && cols.brandName >= 0))
  if (!(cols.title_he >= 0 || cols.title_en >= 0)) result.missingColumns.unshift('title_he')
  if (result.missingColumns.length > 0) return result

  const termsByBusiness = new Map<string, { commission: number; terms: PaymentTerms; row: number }>()
  for (let r = header + 1; r < matrix.length; r++) {
    const line = matrix[r] ?? []
    const get = (column: OfferColumn) => (cols[column] >= 0 ? line[cols[column]] : '')
    if (OFFER_TEMPLATE_COLUMNS.every((column) => text(get(column)) === '')) continue
    if (result.rows.length >= MAX_BATCH_OFFERS) {
      result.tooMany = true
      break
    }
    const errors: BatchCellError[] = []
    const fail = (column: OfferColumn, code: BatchErrorCode) => errors.push({ column, code, cell: `${columnLetter(cols[column] >= 0 ? cols[column] : 0)}${r + 1}` })

    const titleHe = text(get('title_he'))
    const titleEn = text(get('title_en'))
    if (!titleHe && !titleEn) fail(cols.title_he >= 0 ? 'title_he' : 'title_en', 'title_required')
    else if (titleHe.length > MAX_TITLE_LENGTH || titleEn.length > MAX_TITLE_LENGTH) fail('title_he', 'title_long')

    const fulfillmentRaw = text(get('fulfillmentType'))
    const fulfillmentType = fulfillmentRaw ? FULFILLMENT_ALIASES[norm(fulfillmentRaw)] : 'direct_merchant'
    if (!fulfillmentType) fail('fulfillmentType', 'fulfillment_invalid')
    const multipass = fulfillmentType === 'multipass_pool'

    const businessKey = text(get('businessId'))
    const brandName = text(get('brandName'))
    const chains = normalizeChains(text(get('participatingChains')))
    const scopeRaw = text(get('perkScope'))
    let perkScope: PerkScope = 'single_business'
    let businessUid = ''
    if (multipass) {
      // A Multipass perk has a brand (and for a multi-chain voucher, its chains) in place of a business.
      if (scopeRaw && !SCOPE_ALIASES[norm(scopeRaw)]) fail('perkScope', 'scope_invalid')
      else perkScope = scopeRaw ? SCOPE_ALIASES[norm(scopeRaw)]! : chains.length > 0 ? 'multi_chain' : 'single_business'
      if (businessKey) fail('businessId', 'multipass_business')
      if (!brandName) fail('brandName', 'brand_required')
      else if (brandName.length > 80) fail('brandName', 'brand_long')
      else if (perkScope === 'multi_chain' && chains.length === 0) fail('participatingChains', 'chains_required')
      else if (perkScope === 'single_business' && chains.length > 0) fail('participatingChains', 'scope_invalid')
    } else {
      if (brandName || chains.length > 0 || scopeRaw) fail(brandName ? 'brandName' : chains.length > 0 ? 'participatingChains' : 'perkScope', 'direct_brand')
      if (!businessKey) fail('businessId', 'business_required')
      else {
        const resolved = lookup(businessKey)
        if (resolved) businessUid = resolved
        else fail('businessId', 'business_unknown')
      }
    }

    const categoryRaw = text(get('category'))
    const category = categoryRaw ? (BUSINESS_CATEGORIES as readonly string[]).find((c) => norm(c) === norm(categoryRaw)) ?? null : null
    if (categoryRaw && !category) fail('category', 'category_invalid')
    // Nothing to inherit it from: a Multipass perk has no business, so the sheet names its category.
    if (multipass && !categoryRaw) fail('category', 'multipass_category')

    const originalPrice = toNumber(get('originalPrice'))
    const offerPrice = toNumber(get('discountedPrice'))
    if (!Number.isFinite(originalPrice) || originalPrice <= 0) fail('originalPrice', 'original_invalid')
    else if (!Number.isFinite(offerPrice) || offerPrice <= 0) fail('discountedPrice', 'discounted_invalid')
    else if (validateOfferPrices(originalPrice, offerPrice)) fail('discountedPrice', 'price_order')

    const quantityRaw = text(get('totalQuantity'))
    let totalQuantity: number | null = null
    if (quantityRaw && fulfillmentType !== 'multipass_pool') {
      const quantity = toNumber(get('totalQuantity'))
      if (Number.isInteger(quantity) && quantity >= 1) totalQuantity = quantity
      else fail('totalQuantity', 'quantity_invalid')
    }

    const commissionRaw = text(get('commissionRate'))
    const termsRaw = text(get('paymentTerms'))
    let commissionRate: number | null = null
    let paymentTerms: PaymentTerms | null = null
    if (commissionRaw) {
      const n = toNumber(get('commissionRate'))
      const fraction = Number((n > 1 ? n / 100 : n).toFixed(4))
      if (Number.isFinite(n) && isCommissionRate(fraction)) commissionRate = fraction
      else fail('commissionRate', 'commission_invalid')
    }
    if (termsRaw) {
      paymentTerms = parsePaymentTerms(termsRaw)
      if (!paymentTerms) fail('paymentTerms', 'payment_terms_invalid')
    }
    if (multipass && (commissionRaw || termsRaw)) fail(commissionRaw ? 'commissionRate' : 'paymentTerms', 'multipass_terms')
    if (!commissionRaw !== !termsRaw && errors.every((e) => e.column !== 'commissionRate' && e.column !== 'paymentTerms')) fail(commissionRaw ? 'paymentTerms' : 'commissionRate', 'terms_pair')
    if (businessUid && commissionRate !== null && paymentTerms) {
      const seen = termsByBusiness.get(businessUid)
      if (seen && (seen.commission !== commissionRate || seen.terms !== paymentTerms)) fail('commissionRate', 'terms_conflict')
      else if (!seen) termsByBusiness.set(businessUid, { commission: commissionRate, terms: paymentTerms, row: r + 1 })
    }

    const redemptionInstructions = text(get('howToRedeem_he'))
    if (redemptionInstructions.length > MAX_REDEMPTION_INSTRUCTIONS_LENGTH) fail('howToRedeem_he', 'redeem_long')

    const imageUrl = normalizeImageUrl(text(get('imageUrl')))
    if (imageUrl && (!isValidImageUrl(imageUrl) || imageUrlProblem(imageUrl))) fail('imageUrl', 'image_invalid')

    if (errors.length === 0) {
      const check = parsePerkScopeFields({ fulfillmentType: fulfillmentType!, perkScope, businessId: businessUid, brandName, participatingChains: chains })
      if (!check.ok) fail(multipass ? 'brandName' : 'businessId', 'scope_invalid')
    }
    result.rows.push({
      row: r + 1,
      title: titleHe || titleEn,
      businessKey,
      errors,
      offer: errors.length > 0 ? null : {
        titleHe, titleEn, businessUid, perkScope, brandName: multipass ? brandName : '', participatingChains: multipass && perkScope === 'multi_chain' ? chains : [], category, fulfillmentType: fulfillmentType!, originalPrice, offerPrice,
        totalQuantity, commissionRate, paymentTerms, redemptionInstructions, imageUrl,
      },
    })
  }
  return result
}
