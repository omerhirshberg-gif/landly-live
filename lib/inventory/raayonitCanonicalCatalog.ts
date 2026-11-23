// The official Raayonit "תו על" directory facts the sync must honour, on top of the scraped snapshot: brands the scrape
// misses, wording corrections, what is suspended or closed, and the counts a healthy catalogue has. Pure (no I/O), so the
// sync, the seed script and the tests share it. Phone cells Raayonit leaves blank stay blank: nothing is invented.
import type { RaayonitBrand, RaayonitBranch } from './raayonitCatalog'
import { isClosedText, NAMED_CLOSURES } from './raayonitClosure'

const HOTEL_TERMS = [
  'בבתי המלון והארחה יש להיכנס למידע הנוסף בעמודה השמאלית טרם ההזמנה, ישנן מלונות שההזמנות יבוצעו דרך חברת רעיונית בלבד, ובחלק מהמלונות ניתן לממש עד 50% ממחיר העסקה, היתרה תשולם באחד מאמצעי התשלום המקובלים בבית העסק.',
  'ההזמנות יבוצעו דרך חברת רעיונית בלבד ובכפוף לאישור.',
  'הזמנות באמצעות מספר טלפון: 03-9223392 שלוחה 4.',
]

const hotel = (name: string, city: string, phone: string): RaayonitBranch => ({ name, address: city, phone, city })

/** Brands in Raayonit's directory that its network pages do not list. */
export const CANONICAL_EXTRA_BRANDS: RaayonitBrand[] = [
  {
    key: 'l-u-hotels', nameHe: 'יו', nameEn: 'U Hotels', category: 'Israel and Global Tourism', logoUrl: '', siteUrl: 'https://www.fattal.co.il/u-boutique-kinneret-hotel',
    restrictions: HOTEL_TERMS, methods: ['in_store'],
    branches: [
      hotel('יו בוטיק כנרת', 'טבריה', '03-5110050'),
      hotel("יו קורל ביץ' קלאב אילת אולטרה הכל כלול", 'אילת', '03-5110000'),
      hotel("יו מג'יק פאלאס אילת", 'אילת', '03-5110050'),
    ],
  },
]

/** Wording fixes by snapshot key. */
export const CANONICAL_RENAMES: Record<string, string> = { '161': 'טיליה - קליניקה טיפולית', '4': 'HOLMES PLACE' }

/**
 * Brands that must never get a picture of their own: the only one found for them belonged to another business (Torta Loca's site
 * image was the Mexicani restaurant's logo). Every sync and the image build leave them without a logo, so their card shows the
 * Raayonit mark ('fallback') instead.
 */
export const NO_IMAGE_BRAND_KEYS: readonly string[] = ['l-7902'] // Torta Loca

/** Rows that must never reach a card: suspended or closed (brand or branch text). */
export const SUSPENDED_BRAND_KEYS: readonly string[] = ['235'] // Brown Hotels Spa: the site honours no vouchers until further notice
export const CLOSED_BRANCH_PATTERNS: readonly RegExp[] = [/מחנה יהודה.*רוסטרס|רוסטרס.*מחנה יהודה|האפרסק 20/, ...NAMED_CLOSURES.map((c) => new RegExp(c.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))]  // Raayonit's own closure notices are caught by isClosedText (raayonitClosure.ts)

/** Branches whose phone Raayonit's public table leaves empty (kept empty). */
export const BLANK_PHONE_BRANCHES = ['מקס ברנר כרמיאל', 'מקס ברנר ירושלים', 'אצה - סושי בר', 'TALADA'] as const

/** Brand-name pattern (Hebrew + English) -> active branch count after cleanup. */
export const EXPECTED_BRANCH_COUNTS: ReadonlyArray<[string, RegExp, number]> = [
  ['Japan Japan', /JAPAN JAPAN/i, 13], ['Café Café', /^קפה ?קפה$|^Caf[eé] ?Caf[eé]$/i, 42], ['Pizza Agvania', /פיצה עגבני/, 12], ['Pizza Story', /פיצה סטורי/, 48],
  ['Biscotti', /BISCOTTI/i, 9], ['Mr. Pretzels', /Pretzels/i, 17], ['Basher', /באשר/, 17], ['Mexicana', /MEXICANA/i, 7], ['Max Brenner', /MAX BRENNER/i, 6],
  ['4Chef', /^4Chef/i, 6], ['ShareSpa', /ShareSpa/i, 10], ['Tilia', /טיליה/, 4], ['Holmes Place', /HOLMES/i, 8], ['Cinema City', /סינמה סיטי/, 8],
  ['VERT', /^VERT$/, 4], ['Herods', /הרודס/, 4], ['Cafe Roasters', /קפה רוסטרס/, 2], ['U Hotels', /^יו$/, 3], ['La Borsa', /לה בורסה|BORSA|Bourse/i, 2],
]

/** The brand with no image reference at all (the bundled file, its kind and its source). */
function withoutImage<T extends RaayonitBrand>(brand: T): T {
  const { logoFile: _file, logoKind: _kind, logoSource: _source, ...rest } = brand as T & { logoFile?: string; logoKind?: string; logoSource?: string }
  return { ...rest, logoUrl: '' } as unknown as T
}

/** The scraped catalogue with the canonical corrections applied (idempotent). */
export function applyCanonical<T extends RaayonitBrand>(brands: readonly T[]): T[] {
  const out = brands
    .filter((b) => !SUSPENDED_BRAND_KEYS.includes(b.key))
    .map((b) => (CANONICAL_RENAMES[b.key] ? { ...b, nameHe: CANONICAL_RENAMES[b.key]!, nameEn: b.nameEn === b.nameHe ? CANONICAL_RENAMES[b.key]! : b.nameEn } : b))
    .map((b) => (NO_IMAGE_BRAND_KEYS.includes(b.key) ? withoutImage(b) : b))
    .map((b) => ({ ...b, branches: b.branches.filter((br) => !isClosedText(`${br.name} ${br.address}`) && !CLOSED_BRANCH_PATTERNS.some((re) => re.test(`${br.name} ${br.address}`))) }))
  const have = new Set(out.map((b) => b.key))
  return [...out, ...(CANONICAL_EXTRA_BRANDS.filter((b) => !have.has(b.key)) as T[])]
}
