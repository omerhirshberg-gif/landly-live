// The 18 categories of Raayonit's own "מיין לפי תחומים" filter (VoucherNum=253), in the page's order. A listing section maps to
// exactly one; every "רשתות" network page belongs to `networks`. The Hebrew names are Raayonit's own, kept verbatim.
// Pure and client-safe: the sync, the offers API, the website and the app share it.
import membership from './raayonitCategoryMembership.json'
const CATEGORY_MEMBERSHIP = membership as Record<string, readonly string[]>

export const RAAYONIT_CATEGORY_IDS = [
  'chef-restaurants', 'cafes-restaurants', 'cafe-cafe', 'pizza-agvania', 'pizza-story', 'biscotti', 'mr-pretzels', 'all-tastes', 'basher',
  'spa', 'hotels', 'attractions', 'luggage-gadgets-home', 'beauty-lifestyle', 'jewelry', 'cinemas', 'soldier-traveler', 'networks',
] as const
export type RaayonitCategoryId = (typeof RAAYONIT_CATEGORY_IDS)[number]

type Names = { he: string; en: string; ru: string; fr: string; es: string }
export const RAAYONIT_CATEGORY_NAMES: Record<RaayonitCategoryId, Names> = {
  'chef-restaurants': { he: 'מסעדות שף', en: 'Chef Restaurants', ru: 'Шеф-рестораны', fr: 'Restaurants de chefs', es: 'Restaurantes de chef' },
  'cafes-restaurants': { he: 'בתי קפה ומסעדות', en: 'Cafés & Restaurants', ru: 'Кафе и рестораны', fr: 'Cafés et restaurants', es: 'Cafés y restaurantes' },
  'cafe-cafe': { he: 'בתי קפה - סניפי קפה קפה', en: 'Cafés — Café Café Branches', ru: 'Кафе — филиалы Café Café', fr: 'Cafés — succursales Café Café', es: 'Cafés — sucursales Café Café' },
  'pizza-agvania': { he: 'פיצה - רשת פיצה עגבנייה', en: 'Pizza — Pizza Agvania Chain', ru: 'Пицца — сеть Pizza Agvania', fr: 'Pizza — chaîne Pizza Agvania', es: 'Pizza — cadena Pizza Agvania' },
  'pizza-story': { he: 'פיצה - רשת פיצה סטורי', en: 'Pizza — Pizza Story Chain', ru: 'Пицца — сеть Pizza Story', fr: 'Pizza — chaîne Pizza Story', es: 'Pizza — cadena Pizza Story' },
  biscotti: { he: 'ביסקוטי - רשת קונדיטוריות ובתי קפה', en: 'Biscotti — Patisseries & Cafés Chain', ru: 'Biscotti — сеть кондитерских и кафе', fr: 'Biscotti — chaîne de pâtisseries et cafés', es: 'Biscotti — cadena de pastelerías y cafés' },
  'mr-pretzels': { he: 'פרצל - רשת Mr. Pretzels', en: 'Pretzels — Mr. Pretzels Chain', ru: 'Крендели — сеть Mr. Pretzels', fr: 'Bretzels — chaîne Mr. Pretzels', es: 'Pretzels — cadena Mr. Pretzels' },
  'all-tastes': { he: 'מכל הטעמים (שוקולד, יין, פרחים ופינוקים)', en: 'All Tastes — Chocolate, Wine, Flowers & Treats', ru: 'На любой вкус — шоколад, вино, цветы и лакомства', fr: 'Pour tous les goûts — chocolat, vin, fleurs et douceurs', es: 'Para todos los gustos — chocolate, vino, flores y caprichos' },
  basher: { he: "באשר פרומז'רי - גבינות בוטיק ודליקטסים", en: 'Basher Fromagerie — Boutique Cheeses & Delicatessen', ru: 'Basher Fromagerie — бутик-сыры и деликатесы', fr: 'Basher Fromagerie — fromages de boutique et délicatesses', es: 'Basher Fromagerie — quesos boutique y delicatessen' },
  spa: { he: 'ספא', en: 'Spa', ru: 'Спа', fr: 'Spa', es: 'Spa' },
  hotels: { he: 'בתי מלון והארחה', en: 'Hotels & Hospitality', ru: 'Отели и гостевые дома', fr: 'Hôtels et hébergement', es: 'Hoteles y alojamiento' },
  attractions: { he: 'אטרקציות ושונות', en: 'Attractions & Miscellaneous', ru: 'Развлечения и прочее', fr: 'Attractions et divers', es: 'Atracciones y varios' },
  'luggage-gadgets-home': { he: "מזוודות, גאדג'טים, מוצרים לבית, משקפיים וצעצועים", en: 'Luggage, Gadgets, Homeware, Eyewear & Toys', ru: 'Чемоданы, гаджеты, товары для дома, очки и игрушки', fr: 'Valises, gadgets, maison, lunettes et jouets', es: 'Maletas, gadgets, hogar, gafas y juguetes' },
  'beauty-lifestyle': { he: 'טיפוח ולייף סטייל', en: 'Beauty & Lifestyle', ru: 'Красота и лайфстайл', fr: 'Beauté et lifestyle', es: 'Belleza y estilo de vida' },
  jewelry: { he: 'תכשיטים', en: 'Jewelry', ru: 'Украшения', fr: 'Bijoux', es: 'Joyería' },
  cinemas: { he: 'בתי קולנוע', en: 'Cinemas', ru: 'Кинотеатры', fr: 'Cinémas', es: 'Cines' },
  'soldier-traveler': { he: 'לחייל ולמטייל', en: 'For Soldiers & Travelers', ru: 'Для солдат и путешественников', fr: 'Pour soldats et voyageurs', es: 'Para soldados y viajeros' },
  networks: { he: 'רשתות', en: 'Chains', ru: 'Сети', fr: 'Enseignes', es: 'Cadenas' },
}

// Compact pill labels for the categories whose own name runs long (Raayonit's names kept verbatim above): a filter pill never truncates.
// Categories not listed here keep their full name.
const RAAYONIT_CATEGORY_SHORT_NAMES: Partial<Record<RaayonitCategoryId, Names>> = {
  'cafe-cafe': { he: 'קפה קפה', en: 'Café Café', ru: 'Café Café', fr: 'Café Café', es: 'Café Café' },
  'pizza-agvania': { he: 'פיצה עגבנייה', en: 'Pizza Agvania', ru: 'Pizza Agvania', fr: 'Pizza Agvania', es: 'Pizza Agvania' },
  'pizza-story': { he: 'פיצה סטורי', en: 'Pizza Story', ru: 'Pizza Story', fr: 'Pizza Story', es: 'Pizza Story' },
  biscotti: { he: 'ביסקוטי', en: 'Biscotti', ru: 'Biscotti', fr: 'Biscotti', es: 'Biscotti' },
  'mr-pretzels': { he: 'Mr. Pretzels', en: 'Mr. Pretzels', ru: 'Mr. Pretzels', fr: 'Mr. Pretzels', es: 'Mr. Pretzels' },
  'all-tastes': { he: 'מכל הטעמים', en: 'All Tastes', ru: 'На любой вкус', fr: 'Pour tous les goûts', es: 'Para todos los gustos' },
  basher: { he: "באשר פרומז'רי", en: 'Basher Fromagerie', ru: 'Basher Fromagerie', fr: 'Basher Fromagerie', es: 'Basher Fromagerie' },
  'luggage-gadgets-home': { he: "מזוודות וגאדג'טים", en: 'Luggage & Gadgets', ru: 'Чемоданы и гаджеты', fr: 'Valises et gadgets', es: 'Maletas y gadgets' },
}

/** Raayonit's listing section id -> its category. (Section 94, Spacez, lists no rows and is not one of the 18.) */
export const SECTION_CATEGORY_ID: Record<string, RaayonitCategoryId> = {
  '84': 'chef-restaurants', '15': 'cafes-restaurants', '93': 'cafe-cafe', '52': 'pizza-agvania', '110': 'pizza-story', '100': 'biscotti',
  '109': 'mr-pretzels', '19': 'all-tastes', '83': 'basher', '4': 'spa', '78': 'hotels', '20': 'attractions', '97': 'luggage-gadgets-home',
  '112': 'beauty-lifestyle', '96': 'jewelry', '16': 'cinemas', '111': 'soldier-traveler', '12': 'networks',
}

export const isRaayonitCategoryId = (v: unknown): v is RaayonitCategoryId => typeof v === 'string' && (RAAYONIT_CATEGORY_IDS as readonly string[]).includes(v)
export const raayonitCategoryName = (id: RaayonitCategoryId, lang: string): string => RAAYONIT_CATEGORY_NAMES[id][(lang in RAAYONIT_CATEGORY_NAMES.spa ? lang : 'en') as keyof Names]
/** The concise label for a filter pill: the short name where the full one runs long, else the full name. */
export const raayonitCategoryShortName = (id: RaayonitCategoryId, lang: string): string => {
  const short = RAAYONIT_CATEGORY_SHORT_NAMES[id]
  return short ? short[(lang in short ? lang : 'en') as keyof Names] : raayonitCategoryName(id, lang)
}

// A few "רשתות" network pages are the same chains that Raayonit also lists as their own sections (the page for Pizza Story is the
// "פיצה - רשת פיצה סטורי" section): they belong to that section's category, not to "רשתות".
const NETWORK_NAME_CATEGORY: ReadonlyArray<readonly [RegExp, RaayonitCategoryId]> = [
  [/קפה\s*קפה|caf[ée]\s*caf[ée]/i, 'cafe-cafe'], [/פיצה\s*עגבני/, 'pizza-agvania'], [/פיצה\s*סטורי/, 'pizza-story'], [/ביסקוטי|biscotti/i, 'biscotti'],
  [/mr\.?\s*pretzels|פרצל/i, 'mr-pretzels'], [/באשר|bas[h]?er/i, 'basher'], [/סינמה\s*סיטי|cinema\s*city/i, 'cinemas'],
  [/share\s*spa|שיר\s*ספא/i, 'spa'],
  [/^(?!.*(?:ספא|spa)).*(?:\bbrown\b|בראון)/i, 'hotels'], // a Brown hotel, never its spa
]

/** The offer's Raayonit category: the stored one, else the one its source key (and, for a network page, its name) implies. */
export function raayonitCategoryOf(offer: { raayonitCategory?: unknown; sourceKey?: unknown; brandName?: unknown }, byKey: Readonly<Record<string, string>> = {}): RaayonitCategoryId {
  if (isRaayonitCategoryId(offer.raayonitCategory)) return offer.raayonitCategory
  const key = typeof offer.sourceKey === 'string' ? offer.sourceKey.replace(/^raayonit:/, '') : ''
  if (/^\d+$/.test(key)) {
    const name = typeof offer.brandName === 'string' ? offer.brandName : ''
    return NETWORK_NAME_CATEGORY.find(([re]) => re.test(name))?.[1] ?? 'networks'
  }
  const mapped = byKey[key]
  if (isRaayonitCategoryId(mapped)) return mapped
  const section = key.match(/^l-s(\d+)$/)?.[1]
  return (section && SECTION_CATEGORY_ID[section]) || 'cafes-restaurants'
}

/**
 * Every category Raayonit's own filter lists a business under, its primary one first. Raayonit shows a business in each section it
 * appears in (Max Brenner is under both "בתי קפה ומסעדות" and "רשתות"); a card stores one primary category, which stays its badge and
 * what Home counts. The extra ones come from raayonitCategoryMembership.json (scripts/raayonit-category-membership.mts, read from the live
 * directory), so the Raayonit tab's rows and filter can list the business under each of them without any stored field.
 */
export function raayonitCategoriesOf(offer: { raayonitCategory?: unknown; sourceKey?: unknown; brandName?: unknown }, byKey: Readonly<Record<string, string>> = {}): RaayonitCategoryId[] {
  const primary = raayonitCategoryOf(offer, byKey)
  const key = typeof offer.sourceKey === 'string' ? offer.sourceKey.replace(/^raayonit:/, '') : ''
  const extra = (CATEGORY_MEMBERSHIP[key] ?? []).filter(isRaayonitCategoryId)
  return [...new Set([primary, ...extra])]
}
