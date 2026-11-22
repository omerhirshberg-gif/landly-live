import { describe, expect, it } from 'vitest'
import snapshot from '@/lib/inventory/raayonitCatalog.snapshot.json'
import { applyCanonical } from '@/lib/inventory/raayonitCanonicalCatalog'
import { CATEGORY_RULES, inferCategory } from '@/lib/inventory/raayonitCatalog'
import { branchNotice, categoryFor, cleanBranchName, finalizeCatalog, isJunkText, sanitizeBranches } from '@/lib/inventory/raayonitSanitize'
import type { RaayonitBrand } from '@/lib/inventory/raayonitCatalog'

// The approved placement of all 231 Raayonit businesses (the official directory's sections), one list per GoLandly category.
const EXPECTED: Record<string, string[]> = {
  'Chef Restaurants': [
    'הדרל\'ה', 'דיאנא', 'הלנה בנמל קיסריה', 'קימל בגלבוע', 'BAR ITALIA', 'KYOTO', 'capri', 'התרנגול הכחול', 'LUNEL', 'Baba Yaga', 'POMO', 'CAFÉ NAPO', 'כרמא', 'Sheyan',
  ],
  'Restaurants and Cafes': [
    '6 במאי', 'AIR CAFFE', 'Alpaca Bar', 
    'Bali BURGERS', 'BARDAK', 'BISCOTTI',
    'BLEECKER Bakery', 'Bread and Breakfast', 'Butchery', 'Café LUGANO',
    'CaféCafé', 'CAPTAIN HOOK',
    'CASA DO BRASIL', 'CASINO SAN REMO', 'EISAN THAI KITCHEN', 'ENTRECOTE',
    'frangelico', 'fratelli', 'GATOS', 'GiORGiO CAFFE',
    'Gorilla', 'indira', 'iz café', 'JAPAN JAPAN',
    'joya', 'La Vaca Loca', 
    'MANDARIN', 'MAX BRENNER', 'MEXICANA', 'Milano Bakery',
    'MILKA BAR', 'mood', 'Mr Pretzels', 'OLIVE KORNER',
    'PATRICK\'S', 'PIATTO', 'Reef Cafe',
    'SAI SUSHI BAR', 'SCUBAR', 'SHTROUDL',
    'SINTA', 'THE VIEW', 'Torta Loca', 'TORTUGA',
    'ZETZ', 'אווז הזהב', 'אווזי חיפה', 'איטלקיה בפשפשים',
    'איטלקיה בתחנה', 'אצה - סושי בר', 'באשר פרומז\'רי', 'ביאנקיני ים המלח',
    'ביר גרדן כפר סבא', 'גרג', 'דה קרינה - בוטיק שוקולד', 
    'האגדה', 'הבוטקה', 'הטבעונית - J17',
    'הלובי', 'הסושיה', 'הפינה החלבית',
    'השיפודיה של שופן', 'חנל\'ה', 'חצר עין כרם',
    'טנדוקה', 'לחם ארז קריית ביאליק', 'מועדון ארוחת בוקר',
    'מזקקת אולגר - OLGAR DISTILLERY', 'מרינה ביי', 'מרקוס', 'נאבי יונה',
    'נגיסה עפולה', 'נמסטה', 'סינטה בר אקספרס חיפה', 'סיציליאנו',
    'פלאפל גבאי', 'פנה פסטה בר', 'קאסה דל פפה', 
    'קפאין חיפה', 'קפה אביבים', 'קפה אופטימי - italian&israeli kitchen', 'קפה בגולף',
    'קפה גרנד ויסטה', 'קפה נמרוד תל אביב', 'קפה פולה', 'קפה קרמה',
    'קפה רוסטרס', 'קקאו כרמיאל', 'רנה ראש פינה', 'רשת פיצה סטורי',
    'רשת פיצה עגבניה',
  ],
  'Pampering Bundles': [
    'ARMANNI', 'BEN AMI', 'Flamingo Spa', 'HOLMES PLACE',
    'IZEN Spa', 'Leo Spa', 'MILA SPA', 'Rain Drop SPA',
    'ShareSpa', 'Spa - My Touch', 'Spa by CLARINS', 'המרחב הפנימי',
    'טיליה - קליניקה טיפולית', 'מנטרה ספא', 'ניגון הנפש - עינבל ערד', 'ספא אלוויט',
    'ספא דניאל', 'ספא חמת קיסר', 'ספא קאנטרי גן עברון',
    'לאונרדו',
  ],
  'Israel and Global Tourism': [
    'Acco Beach', 'ADAM HOTELS', 'BROWN', 'GORDONIA',
    'NYX תל אביב', 'PIAZZA DEL SOL', 'VERT', 'אדם בוטיק',
    'אורכידאה אילת', 'אורכידאה תל אביב', 'בוטניקה', 'בטבע קדרים בקתות גליליות',
    'בין הזיתים', 'הבקתות של סיון', 'הרודס', 'יו',
    'כפר הנופש מסריק', 'מלון 1935', 'מלון איב',
    'מלון נס עמים', 'מלון סטאי כנרת', 'מלון סטאי תל אביב', 'מלון פיורי 41',
    'קראון פלזה תל אביב', 'קראון פלזה תל אביב סיטי סנטר', 'רוח דרומית', 'שלה ביער',
  ],
  'Attractions and Tours': [
    'Drive for fun', 'ESCAPELAND', 'Picnic', 'saladin comfort',
    'shukeat', 'WALK IN', 'ג\'אסט מיוזיק', 'טרקטורוני לכיש - טיולי טרקטורונים ללא מדריך',
    'ישראל 2 גו - סיורים קולינריים בשווקים', 'לוטונט - חודש הגרלות לוטו משולב', 'מגדל דוד מוזיאון ירושלים', 'מוזיאון העמק',
    'סינמה סיטי', 'קייקי כפר בלום', 'קיפצובה',
  ],
  'Home and Furnishing': [
    '4Chef', 'babycakes - gift boutique', 'BOOL CACTUS', 'BUYLI',
    'Eye Glow', 'Food Appeal', 'FOX home', 'GOLF & CO',
    'Kitan', 'LA FLEUR BOUTIQUE', 'MY DIGO design', 'Naaman',
    'simplybibo', 'TITANIUM', 'VARDINON', 'אהבה קטנה',
    'אופק חדש - מוצרים לאורח חיים בריא', 'טרקלין חשמל', 'מכלול',
    'פריחת הסחלב', 'צומת ספרים', 'צמר - שטיחים יפים', 'רשת קרביץ',
  ],
  'Kids and Baby': [
    'carters', 'GOLF KIDS & Baby', 'THE CHILDREN\'S PLACE', 'TOYS R US',
    'שילב',
  ],
  'Beauty and Skincare': [
    'Dr. Dabour', 'LALINE', 'ROSE BEAUTY BY NATURE', 'סבון של פעם',
    'ארבל עיצוב פנים - מומלץ אמון הציבור',
  ],
  'Fashion and Shopping': [
    'aerie', 'ALDO', 'AMERICAN EAGLE', 'BILLABONG',
    'DIAMOND FACTORY', 'DKNY', 'EMPORIUM', 'Foot Locker',
    'FOX', 'G CONCEPT STORE', 'Gali', 'GOLF',
    'GUESS', 'H&O', 'INTIMA', 'LA-BORSA',
    'Lee Cooper', 'MANGO', 'MASHBIR', 'MAX MORETTI',
    'NAUTICA', 'NINE WEST', 'ONE PROJECT', 'POLGAT',
    'SAM EDELAMAN', 'SHOW/OFF', 'TALADA', 'Timberland',
    'VILEBREQUIN TEL AVIV', 'ארנקי עמנואל',
  ],
  'Sport and Fitness': [
    'מגה ספורט',
  ],
}


const brand = (over: Partial<RaayonitBrand>): RaayonitBrand => ({ key: 'x', nameHe: 'x', nameEn: '', category: 'Fashion and Shopping', logoUrl: '', siteUrl: '', restrictions: [], methods: ['in_store'], branches: [], ...over })
const b = (name: string, address = 'א 1, חיפה') => ({ name, address, phone: '' })

describe('branch sanitising', () => {
  it('drops suspended and junk rows', () => {
    for (const t of ['האתר לא מכבד תווים עד להודעה חדשה, עמכם הסליחה! - VILLA BROWN JERUSALEM SPA', 'המלון סגור לרגל שיפוצים', 'סגור זמנית', 'לפירוט לחץ כאן', 'שם האתר']) expect(isJunkText(t)).toBe(true)
    expect(sanitizeBranches([b('האתר לא מכבד תווים - X'), b('סניף חיפה')]).map((x) => x.name)).toEqual(['סניף חיפה'])
  })
  it('cleans takeaway tails into a notice and removes duplicates', () => {
    const name = "ג'אפן ג'אפן טבריה - התו תקף לטייק - אווי ומשלוחים טלפונית בלבד"
    expect(cleanBranchName(name)).toBe("ג'אפן ג'אפן טבריה")
    expect(branchNotice(name)).toContain('טייק')
    expect(sanitizeBranches([b('A'), b('A'), b('A', 'אחר')])).toHaveLength(2)
  })
})

describe('catalogue finalising', () => {
  it('merges one business listed twice and moves the notice into its restrictions', () => {
    const out = finalizeCatalog([
      brand({ key: '12', nameHe: 'JAPAN JAPAN', nameEn: 'JAPAN JAPAN', logoUrl: 'https://x/l.jpg', branches: [b('JJ חיפה')] }),
      brand({ key: 'l-japan', nameHe: "ג'אפן ג'אפן", branches: [b("ג'אפן ג'אפן טבריה - התו תקף לטייק - אווי ומשלוחים טלפונית בלבד", 'ב 2, טבריה')] }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]!.key).toBe('12')
    expect(out[0]!.branches.map((x) => x.name)).toEqual(['JJ חיפה', "ג'אפן ג'אפן טבריה"])
    expect(out[0]!.restrictions.join(' ')).toContain('טייק')
    expect(out[0]!.methods).toContain('phone_booking')
  })
  it('drops a brand whose every branch was suspended', () => {
    expect(finalizeCatalog([brand({ key: 'q', nameHe: 'ספא ק', branches: [b('האתר לא מכבד תווים - ספא ק')] })])).toEqual([])
  })
  it('puts every one of the 231 bundled brands in its exact category', () => {
    const out = finalizeCatalog(applyCanonical((snapshot as { brands: RaayonitBrand[] }).brands))
    expect(out).toHaveLength(231)
    const expected = new Map(Object.entries(EXPECTED).flatMap(([category, names]) => names.map((n) => [n, category] as const)))
    expect(expected.size).toBe(231)
    expect(Object.values(EXPECTED).flat()).toHaveLength(231)
    const actual = new Map(out.map((x) => [x.nameHe, x.category] as const))
    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort())
    expect(Object.fromEntries([...actual].filter(([n, c]) => expected.get(n) !== c))).toEqual({})
    // the importers' fallback agrees with the sync's table, brand by brand
    for (const x of out) expect(inferCategory(x.nameHe, x.restrictions), x.nameHe).toBe(x.category)
  })
  it('keeps the regression cases in their categories', () => {
    const cat = (nameHe: string, nameEn = '') => categoryFor({ nameHe, nameEn, category: 'Fashion and Shopping' })
    expect(cat('HOLMES PLACE', 'HOLMES PLACE')).toBe('Pampering Bundles')
    expect(cat('HoLMES PLACE', 'HoLMES PLACE')).toBe('Pampering Bundles')
    expect(cat('Milano Bakery')).toBe('Restaurants and Cafes')
    expect(cat('MILA SPA')).toBe('Pampering Bundles')
    expect(cat('MAX BRENNER', 'MAX BRENNER')).toBe('Restaurants and Cafes')
    expect(cat('ביאנקיני ים המלח')).toBe('Restaurants and Cafes')
    expect(cat('יו', 'U Hotels')).toBe('Israel and Global Tourism')
    for (const chef of ["הדרל'ה", 'דיאנא', 'הלנה בנמל קיסריה', 'קימל בגלבוע', 'BAR ITALIA', 'KYOTO', 'capri', 'התרנגול הכחול', 'LUNEL', 'Baba Yaga', 'POMO', 'CAFÉ NAPO', 'כרמא', 'Sheyan']) expect(cat(chef), chef).toBe('Chef Restaurants')
    // Raayonit lists these two under "בתי קפה ומסעדות", not its chef section.
    for (const cafe of ['מרקוס', "PATRICK'S"]) expect(cat(cafe), cafe).toBe('Restaurants and Cafes')
    expect(cat('לאונרדו')).toBe('Pampering Bundles')
    expect(cat('ארבל עיצוב פנים - מומלץ אמון הציבור')).toBe('Beauty and Skincare')
    for (const food of ['joya', 'טנדוקה', 'הסושיה', 'iz café', 'הפינה החלבית', 'הלובי']) expect(cat(food), food).toBe('Restaurants and Cafes')
    expect(cat('מגה ספורט')).toBe('Sport and Fitness')
    expect(cat('FOX')).toBe('Fashion and Shopping')
    expect(cat('FOX home')).toBe('Home and Furnishing')
    expect(cat('ADAM HOTELS')).toBe('Israel and Global Tourism')
  })
  it('lets an unlisted business keep the category it came with', () => {
    expect(categoryFor({ nameHe: 'עסק חדש', nameEn: '', category: 'Kids and Baby' })).toBe('Kids and Baby')
    expect(CATEGORY_RULES.every(([re]) => !re.test('Milano') && !re.test('MILA'))).toBe(true)
  })
  it('leaves no suspended branch and no duplicated business in the bundled snapshot', () => {
    const out = finalizeCatalog((snapshot as { brands: RaayonitBrand[] }).brands)
    expect(out.flatMap((x) => x.branches).filter((r) => isJunkText(r.name) || isJunkText(r.address))).toEqual([])
    const names = out.map((x) => x.nameHe.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
    expect(out.length).toBeLessThan(245)
  })
})
