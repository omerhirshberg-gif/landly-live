// Browser only: builds landly_offers_template.xlsx on demand (SheetJS is loaded when
// someone clicks), so there is no binary to keep in the repo.

import { OFFER_TEMPLATE_COLUMNS, type OfferColumn } from './offersBatch'

// Each column's name stays English (what the importer reads); the Hebrew in brackets is for the person filling it in.
const HEBREW_LABELS: Record<OfferColumn, string> = {
  title_he: 'כותרת בעברית', title_en: 'כותרת באנגלית', businessId: 'מזהה בית עסק', category: 'קטגוריה', fulfillmentType: 'ערוץ',
  originalPrice: 'מחיר מקורי', discountedPrice: 'מחיר אחרי הנחה', totalQuantity: 'כמות', commissionRate: 'עמלה', paymentTerms: 'תנאי תשלום',
  howToRedeem_he: 'הוראות מימוש', imageUrl: 'קישור לתמונה', perkScope: 'סוג הטבת מולטיפאס', brandName: 'שם המותג', participatingChains: 'רשתות מכבדות',
}

export const OFFERS_TEMPLATE_FILENAME = 'landly_offers_template.xlsx'

const EXAMPLE_ROW = [
  'ארוחת בוקר זוגית', 'Breakfast for two', '<business id or company number>', 'Restaurants and Cafes', 'direct_merchant',
  120, 79, 100, 10, 'net_30', 'מציגים את השובר בקופה', 'https://example.com/photo.jpg', '', '', '',
]

// A Multipass perk names its brand (and, for a multi-chain voucher, its chains) instead of a business.
const MULTIPASS_EXAMPLE_ROW = [
  '<title in Hebrew>', '<title in English>', '', 'Fashion and Shopping', 'multipass_pool',
  200, 180, '', '', '', 'מציגים את הקוד בקופה', '', 'multi_chain', '<brand name>', '<chain>; <chain>',
]

const NOTES: (string | number)[][] = [
  ['Column', 'Notes'],
  ['title_he / title_en', 'At least one. The other language is translated automatically when left empty.'],
  ['businessId', 'The business’s id (shown in its page address) or its company number.'],
  ['category', 'Optional. Defaults to the business’s category.'],
  ['fulfillmentType', 'direct_merchant (default) or multipass_pool. Multipass codes are loaded afterwards on the Stock & Vouchers page.'],
  ['perkScope / brandName', 'Multipass rows only. brandName is required and replaces the business. perkScope is single_business (default) or multi_chain; the category is required too.'],
  ['participatingChains', 'Multi-chain rows only: the chains that honour the voucher, separated by semicolons.'],
  ['businessId', 'Leave empty on a Multipass row. Local-business rows need it.'],
  ['originalPrice / discountedPrice', 'In shekels. The discounted price must be lower.'],
  ['totalQuantity', 'Direct offers only. Empty means unlimited.'],
  ['commissionRate / paymentTerms', 'Optional, together. 10 or 0.1 for 10%; net_0, net_15, net_30, net_45 or net_60. Saved on the business.'],
  ['howToRedeem_he / imageUrl', 'Optional.'],
]

export async function downloadOffersTemplate() {
  const XLSX = await import('xlsx')
  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([OFFER_TEMPLATE_COLUMNS.map((name) => `${name} (${HEBREW_LABELS[name]})`), EXAMPLE_ROW, MULTIPASS_EXAMPLE_ROW])
  sheet['!cols'] = OFFER_TEMPLATE_COLUMNS.map((name) => ({ wch: Math.max(22, name.length + HEBREW_LABELS[name].length + 6) }))
  XLSX.utils.book_append_sheet(book, sheet, 'Offers')
  const notes = XLSX.utils.aoa_to_sheet(NOTES)
  notes['!cols'] = [{ wch: 32 }, { wch: 110 }]
  XLSX.utils.book_append_sheet(book, notes, 'Notes')
  XLSX.writeFile(book, OFFERS_TEMPLATE_FILENAME)
}
