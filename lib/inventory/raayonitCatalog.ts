// Raayonit's "תו על" (VoucherNum=253) catalogue: which brands honour it, at which branches, how, and with what
// fine print. Pure (no I/O, no Firebase), so the server sync, the Excel importer and the tests share it.
// Sources: the public pages (parseNetworkIndex / parseNetworkPage) and a supplier sheet (parseBrandsSheet).

export const RAAYONIT_VOUCHER_NUM = 253
export const RAAYONIT_BASE = 'https://www.raayonit.co.il/Site/he/pages/'
export const networkUrl = (key: string) => `${RAAYONIT_BASE}inPage.asp?catID=3&VoucherNum=${RAAYONIT_VOUCHER_NUM}&ShowNetworks=1&NetworkNum=${encodeURIComponent(key)}`
export const showNetworksUrl = () => `${RAAYONIT_BASE}inPage.asp?catID=3&VoucherNum=${RAAYONIT_VOUCHER_NUM}&ShowNetworks=1`
export const indexUrl = () => `${RAAYONIT_BASE}inPage.asp?catID=3&MainCatNum=8&TopCatNum=22&CatNum=23&VoucherNum=${RAAYONIT_VOUCHER_NUM}`

export type CatalogMethod = 'in_store' | 'online' | 'phone_booking'

export interface RaayonitBranch { name: string; address: string; phone: string; kosher?: boolean; city?: string }

export interface RaayonitBrand {
  /** Stable id: Raayonit's NetworkNum, or a slug of the name for a sheet row. */
  key: string
  nameHe: string
  nameEn: string
  category: string
  logoUrl: string
  siteUrl: string
  /** The brand's own limits, one per entry, without the leading dash. */
  restrictions: string[]
  /** How it is honoured: always in store; "online" and "phone" when the fine print says so. */
  methods: CatalogMethod[]
  branches: RaayonitBranch[]
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
export function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
}
const text = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/[‎‏]/g, '').replace(/\s+/g, ' ').trim()

/** The network ids listed on the "רשתות" index, with the logo each one links from. */
export function parseNetworkIndex(html: string): { key: string; logoUrl: string }[] {
  const out = new Map<string, string>()
  for (const m of html.matchAll(/<a[^>]*NetworkNum=(\d+)[^>]*>\s*<img[^>]*src="([^"]+)"/g)) if (!out.has(m[1]!)) out.set(m[1]!, m[2]!)
  for (const m of html.matchAll(/NetworkNum=(\d+)/g)) if (!out.has(m[1]!)) out.set(m[1]!, '')
  return [...out].map(([key, logoUrl]) => ({ key, logoUrl })).sort((a, b) => Number(a.key) - Number(b.key))
}

/**
 * The one table of which GoLandly category each Raayonit brand belongs to, by exact name (case, spacing and `.` ignored). Every business in
 * Raayonit's directory is listed, so a name never matches by accident ("MILA SPA" is a spa, "Milano Bakery" is a bakery). Pure; shared by the
 * sync (through `categoryFor` in raayonitSanitize.ts), the importers and the tests.
 */
const CATEGORY_TABLE: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['Restaurants and Cafes', [
    '6 במאי', 'AIR CAFFE', 'Alpaca Bar', 'Baba Yaga',
    'Bali BURGERS', 'BAR ITALIA', 'BARDAK', 'BISCOTTI',
    'BLEECKER Bakery', 'Bread and Breakfast', 'Butchery', 'Café LUGANO',
    'CAFÉ NAPO', 'CaféCafé', 'capri', 'CAPTAIN HOOK',
    'CASA DO BRASIL', 'CASINO SAN REMO', 'EISAN THAI KITCHEN', 'ENTRECOTE',
    'frangelico', 'fratelli', 'GATOS', 'GiORGiO CAFFE',
    'Gorilla', 'indira', 'iz café', 'JAPAN JAPAN',
    'joya', 'KYOTO', 'La Vaca Loca', 'LUNEL',
    'MANDARIN', 'MAX BRENNER', 'MEXICANA', 'Milano Bakery',
    'MILKA BAR', 'mood', 'Mr Pretzels', 'OLIVE KORNER',
    'PATRICK\'S', 'PIATTO', 'POMO', 'Reef Cafe',
    'SAI SUSHI BAR', 'SCUBAR', 'Sheyan', 'SHTROUDL',
    'SINTA', 'THE VIEW', 'Torta Loca', 'TORTUGA',
    'ZETZ', 'אווז הזהב', 'אווזי חיפה', 'איטלקיה בפשפשים',
    'איטלקיה בתחנה', 'אצה - סושי בר', 'באשר פרומז\'רי', 'ביאנקיני ים המלח',
    'ביר גרדן כפר סבא', 'גרג', 'דה קרינה - בוטיק שוקולד', 'דיאנא',
    'האגדה', 'הבוטקה', 'הדרל\'ה', 'הטבעונית - J17',
    'הלובי', 'הלנה בנמל קיסריה', 'הסושיה', 'הפינה החלבית',
    'השיפודיה של שופן', 'התרנגול הכחול', 'חנל\'ה', 'חצר עין כרם',
    'טנדוקה', 'כרמא', 'לחם ארז קריית ביאליק', 'מועדון ארוחת בוקר',
    'מזקקת אולגר - OLGAR DISTILLERY', 'מרינה ביי', 'מרקוס', 'נאבי יונה',
    'נגיסה עפולה', 'נמסטה', 'סינטה בר אקספרס חיפה', 'סיציליאנו',
    'פלאפל גבאי', 'פנה פסטה בר', 'קאסה דל פפה', 'קימל בגלבוע',
    'קפאין חיפה', 'קפה אביבים', 'קפה אופטימי - italian&israeli kitchen', 'קפה בגולף',
    'קפה גרנד ויסטה', 'קפה נמרוד תל אביב', 'קפה פולה', 'קפה קרמה',
    'קפה רוסטרס', 'קקאו כרמיאל', 'רנה ראש פינה', 'רשת פיצה סטורי',
    'רשת פיצה עגבניה', 'Mr. Pretzels', 'פיצה עגבנייה', 'קפה קפה',
  ]],
  ['Pampering Bundles', [
    'ARMANNI', 'BEN AMI', 'Flamingo Spa', 'HoLMES PLACE',
    'IZEN Spa', 'Leo Spa', 'MILA SPA', 'Rain Drop SPA',
    'ShareSpa', 'Spa - My Touch', 'Spa by CLARINS', 'המרחב הפנימי',
    'טיליה - קליניקה טיפולית', 'מנטרה ספא', 'ניגון הנפש - עינבל ערד', 'ספא אלוויט',
    'ספא דניאל', 'ספא חמת קיסר', 'ספא קאנטרי גן עברון', 'הולמס פלייס',
  ]],
  ['Israel and Global Tourism', [
    'Acco Beach', 'ADAM HOTELS', 'BROWN', 'GORDONIA',
    'NYX תל אביב', 'PIAZZA DEL SOL', 'VERT', 'אדם בוטיק',
    'אורכידאה אילת', 'אורכידאה תל אביב', 'בוטניקה', 'בטבע קדרים בקתות גליליות',
    'בין הזיתים', 'הבקתות של סיון', 'הרודס', 'יו',
    'כפר הנופש מסריק', 'לאונרדו', 'מלון 1935', 'מלון איב',
    'מלון נס עמים', 'מלון סטאי כנרת', 'מלון סטאי תל אביב', 'מלון פיורי 41',
    'קראון פלזה תל אביב', 'קראון פלזה תל אביב סיטי סנטר', 'רוח דרומית', 'שלה ביער',
  ]],
  ['Attractions and Tours', [
    'Drive for fun', 'ESCAPELAND', 'Picnic', 'saladin comfort',
    'shukeat', 'WALK IN', 'ג\'אסט מיוזיק', 'טרקטורוני לכיש - טיולי טרקטורונים ללא מדריך',
    'ישראל 2 גו - סיורים קולינריים בשווקים', 'לוטונט - חודש הגרלות לוטו משולב', 'מגדל דוד מוזיאון ירושלים', 'מוזיאון העמק',
    'סינמה סיטי', 'קייקי כפר בלום', 'קיפצובה',
  ]],
  ['Home and Furnishing', [
    '4Chef', 'babycakes - gift boutique', 'BOOL CACTUS', 'BUYLI',
    'Eye Glow', 'Food Appeal', 'FOX home', 'GOLF & CO',
    'Kitan', 'LA FLEUR BOUTIQUE', 'MY DIGO design', 'Naaman',
    'simplybibo', 'TITANIUM', 'VARDINON', 'אהבה קטנה',
    'אופק חדש - מוצרים לאורח חיים בריא', 'ארבל עיצוב פנים - מומלץ אמון הציבור', 'טרקלין חשמל', 'מכלול',
    'פריחת הסחלב', 'צומת ספרים', 'צמר - שטיחים יפים', 'רשת קרביץ',
  ]],
  ['Kids and Baby', [
    'carters', 'GOLF KIDS & Baby', 'THE CHILDREN\'S PLACE', 'TOYS R US',
    'שילב',
  ]],
  ['Beauty and Skincare', [
    'Dr. Dabour', 'LALINE', 'ROSE BEAUTY BY NATURE', 'סבון של פעם',
  ]],
  ['Fashion and Shopping', [
    'aerie', 'ALDO', 'AMERICAN EAGLE', 'BILLABONG',
    'DIAMOND FACTORY', 'DKNY', 'EMPORIUM', 'Foot Locker',
    'FOX', 'G CONCEPT STORE', 'Gali', 'GOLF',
    'GUESS', 'H&O', 'INTIMA', 'LA-BORSA',
    'Lee Cooper', 'MANGO', 'MASHBIR', 'MAX MORETTI',
    'NAUTICA', 'NINE WEST', 'ONE PROJECT', 'POLGAT',
    'SAM EDELAMAN', 'SHOW/OFF', 'TALADA', 'Timberland',
    'VILEBREQUIN TEL AVIV', 'ארנקי עמנואל',
  ]],
  ['Sport and Fitness', [
    'מגה ספורט',
  ]],
]

const nameKey = (name: string): string => name.normalize('NFC').toLowerCase().replace(/[.\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim()
const BY_NAME: ReadonlyMap<string, string> = new Map(CATEGORY_TABLE.flatMap(([category, names]) => names.map((n) => [nameKey(n), category] as const)))

/** Anchored, whole-name patterns per category, in table order (first match wins; the names are disjoint, so order never decides). */
export const CATEGORY_RULES: ReadonlyArray<readonly [RegExp, string]> = CATEGORY_TABLE.map(([category, names]) => [new RegExp(`^(?:${names.map((n) => nameKey(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`, 'iu'), category] as const)

/** The category of a known brand by its Hebrew or English name; null for a business the table does not list. */
export function knownCategory(nameHe: string, nameEn = ''): string | null {
  return BY_NAME.get(nameKey(nameHe)) ?? (nameEn ? BY_NAME.get(nameKey(nameEn)) : undefined) ?? null
}

const SPA = /ספא|גלובל תו|קליניקה|spa\b/i
const FOOD = /ארוחות|משלוחים|שולחן|מסעד|קפה|cafe|pizza|פיצה|בית קפה|ביס|סושי|sushi|burger|pretzel|bakery|מאפ/i
const SPORT = /ספורט|כושר|fitness|gym/i
const FUN = /סינמה|קולנוע|cinema|אטרקצי|חדרי בריחה|פארק|הצג/i

/** The category for a brand: the table above, and for a business it does not list (a new brand on Raayonit's pages) a guess from its name and fine print. */
export function inferCategory(nameHe: string, restrictions: string[]): string {
  const known = knownCategory(nameHe, /^[\x20-\x7e]+$/.test(nameHe) ? nameHe : '')
  if (known) return known
  const hay = `${nameHe} ${restrictions.join(' ')}`
  if (SPORT.test(hay)) return 'Sport and Fitness'
  if (SPA.test(hay)) return 'Pampering Bundles'
  if (FUN.test(hay)) return 'Attractions and Tours'
  if (FOOD.test(hay)) return 'Restaurants and Cafes'
  return 'Fashion and Shopping'
}

/** In store always; online / by phone when the fine print mentions it. */
export function inferMethods(restrictions: string[]): CatalogMethod[] {
  const hay = restrictions.join(' ')
  const methods: CatalogMethod[] = ['in_store']
  if (/אונליין|online|באתר|באינטרנט/i.test(hay)) methods.push('online')
  if (/טלפונ|בטלפון|הזמנה טלפונית/.test(hay)) methods.push('phone_booking')
  return methods
}

/** One network's page: its name, logo, fine print, site and branch rows. Null when it isn't a network page. */
export function parseNetworkPage(html: string, key: string, indexLogo = ''): RaayonitBrand | null {
  const nameMatch = html.match(/<div class="current"><a[^>]*>([\s\S]*?)<\/a>/)
  const nameHe = nameMatch ? text(nameMatch[1]!) : ''
  if (!nameHe) return null
  const info = html.match(/<td style="width:1px;">\s*<div>\s*<img[^>]*src="([^"]+)"[\s\S]*?<td[^>]*>\s*<div>([\s\S]*?)<\/div>\s*(?:<a href="([^"]*)"[^>]*class="network_link")?/)
  const restrictions = (info ? info[2]!.split(/<br\s*\/?>/i) : []).map((line) => text(line).replace(/^[-–•]\s*/, '')).filter(Boolean)
  const branches: RaayonitBranch[] = []
  for (const row of html.split('rtype="summary"').slice(1)) {
    const name = row.match(/<b>([\s\S]*?)<\/b>/)
    if (!name) continue
    const address = row.match(/<div class="address[^"]*">([\s\S]*?)<\/div>/)
    const phone = row.match(/<div class="phones[^"]*">([\s\S]*?)<\/div>/)
    branches.push({ name: text(name[1]!), address: address ? text(address[1]!) : '', phone: phone ? text(phone[1]!) : '' })
  }
  return {
    key,
    nameHe,
    nameEn: /^[\x20-\x7e]+$/.test(nameHe) ? nameHe : '',
    category: inferCategory(nameHe, restrictions),
    logoUrl: indexLogo || info?.[1] || '',
    siteUrl: info?.[3] ?? '',
    restrictions,
    methods: inferMethods(restrictions),
    branches,
  }
}

export const MAX_BRANCH_LABEL = 100

/** A branch as one list entry: its name and where it is. */
export function branchLabel(branch: RaayonitBranch): string {
  const where = branch.address && !branch.name.includes(branch.address) ? ` — ${branch.address}` : ''
  const label = `${branch.name}${where}`.replace(/\s+/g, ' ').trim()
  return label.length > MAX_BRANCH_LABEL ? `${label.slice(0, MAX_BRANCH_LABEL - 1).trimEnd()}…` : label
}

/** The redemption steps for a brand, one per line. */
export function brandInstructions(brand: Pick<RaayonitBrand, 'methods'>, lang: 'he' | 'en'): string {
  const he = lang === 'he'
  const lines = [he ? 'מגיעים לאחד הסניפים המכבדים את התו ומציגים או מקריאים את קוד התו בקופה.' : 'Visit a participating branch and show or read out your voucher code at the till.']
  if (brand.methods.includes('online')) lines.push(he ? 'ניתן לממש גם באתר הרשת: מזינים את קוד התו בשלב התשלום.' : "You can also redeem on the brand's website: enter the code at checkout.")
  if (brand.methods.includes('phone_booking')) lines.push(he ? 'ניתן לממש גם בהזמנה טלפונית: מציינים שמשלמים בתו ומקריאים את הקוד.' : 'You can also redeem by phone: say you are paying with a voucher and read out the code.')
  return lines.join('\n')
}

// ---- Supplier sheet (the Excel fallback): one row per branch, brand columns repeated. ----

export const BRANDS_SHEET_HEADERS = ['brand_he', 'brand_en', 'category', 'logo_url', 'site_url', 'restrictions', 'redemption', 'branch_name', 'branch_address', 'branch_phone'] as const
const HEADER_ALIASES: Record<(typeof BRANDS_SHEET_HEADERS)[number], string[]> = {
  brand_he: ['brand_he', 'brand', 'שם המותג', 'מותג', 'שם הרשת', 'רשת'],
  brand_en: ['brand_en', 'brand (english)'],
  category: ['category', 'קטגוריה', 'תחום'],
  logo_url: ['logo_url', 'logo', 'לוגו'],
  site_url: ['site_url', 'website', 'אתר'],
  restrictions: ['restrictions', 'הגבלות', 'תקנון'],
  redemption: ['redemption', 'אופן מימוש', 'מימוש'],
  branch_name: ['branch_name', 'branch', 'שם סניף', 'סניף'],
  branch_address: ['branch_address', 'address', 'כתובת'],
  branch_phone: ['branch_phone', 'phone', 'טלפון'],
}
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '_')

export interface BrandsSheetResult { brands: RaayonitBrand[]; missingColumns: string[]; skipped: number }

/** Reads a supplier sheet: a header row, then a branch per row; rows sharing a brand are merged. Restrictions split on new lines. */
export function parseBrandsSheet(matrix: unknown[][]): BrandsSheetResult {
  const headerIndex = matrix.findIndex((row) => row.some((c) => HEADER_ALIASES.brand_he.map(norm).includes(norm(c))))
  if (headerIndex < 0) return { brands: [], missingColumns: ['brand_he'], skipped: 0 }
  const header = matrix[headerIndex]!.map(norm)
  const col = (name: keyof typeof HEADER_ALIASES) => header.findIndex((h) => HEADER_ALIASES[name].map(norm).includes(h))
  const idx = Object.fromEntries(BRANDS_SHEET_HEADERS.map((h) => [h, col(h)])) as Record<(typeof BRANDS_SHEET_HEADERS)[number], number>
  const byKey = new Map<string, RaayonitBrand>()
  let skipped = 0
  for (const row of matrix.slice(headerIndex + 1)) {
    const cell = (h: (typeof BRANDS_SHEET_HEADERS)[number]) => (idx[h] >= 0 ? String(row[idx[h]] ?? '').trim() : '')
    const nameHe = cell('brand_he')
    if (!nameHe) { if (row.some((c) => String(c ?? '').trim())) skipped++; continue }
    const key = `sheet-${nameHe.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}`
    let brand = byKey.get(key)
    if (!brand) {
      const restrictions = cell('restrictions').split(/\r?\n/).map((l) => l.replace(/^[-–•]\s*/, '').trim()).filter(Boolean)
      const methods = new Set<CatalogMethod>(['in_store'])
      for (const part of cell('redemption').toLowerCase().split(/[,;|]/)) {
        const p = part.trim()
        if (/online|אונליין|אתר/.test(p)) methods.add('online')
        if (/phone|טלפון/.test(p)) methods.add('phone_booking')
      }
      for (const m of inferMethods(restrictions)) methods.add(m)
      brand = { key, nameHe, nameEn: cell('brand_en') || (/^[\x20-\x7e]+$/.test(nameHe) ? nameHe : ''), category: cell('category') || inferCategory(nameHe, restrictions), logoUrl: cell('logo_url'), siteUrl: cell('site_url'), restrictions, methods: [...methods], branches: [] }
      byKey.set(key, brand)
    }
    const name = cell('branch_name')
    if (name) brand.branches.push({ name, address: cell('branch_address'), phone: cell('branch_phone') })
  }
  const missingColumns = (['brand_he'] as const).filter((h) => idx[h] < 0)
  return { brands: [...byKey.values()], missingColumns, skipped }
}

/** The template admins download: headers plus one worked example. */
export function brandsSheetTemplate(): string[][] {
  return [
    [...BRANDS_SHEET_HEADERS],
    ['הולמס פלייס', 'Holmes Place', 'Sport and Fitness', 'https://example.com/logo.png', 'https://example.com', '- התו אינו תקף לכפל מבצעים\n- יש לציין בעת התשלום שמשלמים בתו על', 'in_store', 'הולמס פלייס תל אביב', 'קניון עזריאלי, תל אביב', '03-1234567'],
  ]
}

export const FILE_EXT = /\.(jpe?g|png|webp|gif)(?:\?|$)/i
export const logoFileName = (key: string, url: string) => `${key.replace(/[^\w-]+/g, '')}.${(url.match(FILE_EXT)?.[1] ?? 'png').toLowerCase().replace('jpeg', 'jpg')}`
