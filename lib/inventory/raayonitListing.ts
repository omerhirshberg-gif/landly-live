// Raayonit's full "תו על" listing (VoucherNum=253): every business and branch by section (chef restaurants, cafes,
// chains, spas, hotels, attractions ...), each with a detail pane (own image, blurb, notes) fetched per row.
// Pure (no I/O): the scraper script and the tests share it. The 74 "רשתות" network pages are parsed in raayonitCatalog.ts.
import { decodeEntities, inferCategory, inferMethods, type RaayonitBrand, type RaayonitBranch } from './raayonitCatalog'

export interface ListingSection { id: string; title: string; description: string }
export interface ListingRow {
  rowId: string; sid: string; sectionId: string; regionId: string
  title: string; address: string; phone: string; website: string; kosher: boolean
}
export interface SupplierInfo { image: string; notes: string[]; text: string }

const text = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/[‎‏]/g, '').replace(/\s+/g, ' ').trim()

export function parseListingSections(html: string): ListingSection[] {
  const out: ListingSection[] = []
  for (const m of html.matchAll(/id="supplier_header_(\d+)">\s*<div class="title">([\s\S]*?)<\/div>\s*(?:<div class="desc">([\s\S]*?)<\/div>)?/g)) {
    out.push({ id: m[1]!, title: text(m[2]!), description: m[3] ? text(m[3]).replace(/^[-–•]\s*/, '') : '' })
  }
  return out
}

export function parseListingRows(html: string): ListingRow[] {
  const tags = [...html.matchAll(/<div class="row supplier_item_(\d+)"[^>]*?regid="(\d+)"[^>]*?rtype="summary"[^>]*?rowid="(\d+)"[^>]*?sid="(\d+)"[^>]*?kashrut="(\d)"[^>]*>([\s\S]*?)(?=<div class="details supplier_item_)/g)]
  return tags.map((m) => {
    const body = m[6]!
    const title = body.match(/<div class="title">\s*<b>([\s\S]*?)<\/b>/)
    const address = body.match(/<div class="address[^"]*">([\s\S]*?)<\/div>/)
    const phone = body.match(/<div class="phones[^"]*">([\s\S]*?)<\/div>/)
    const site = body.match(/<a href="([^"]*)"[^>]*class="grid_website"/)
    const kashrutCell = body.match(/<div class="kashrut">([\s\S]*?)<\/div>/)
    return {
      rowId: m[3]!, sid: m[4]!, sectionId: m[1]!, regionId: m[2]!,
      title: title ? text(title[1]!) : '', address: address ? text(address[1]!) : '', phone: phone ? text(phone[1]!) : '',
      website: site?.[1] ?? '', kosher: m[5] !== '0' || /כשר/.test(kashrutCell ? text(kashrutCell[1]!) : ''),
    }
  }).filter((r) => r.title)
}

/** One row's detail pane (SupplierVoucherInfo.asp): its own image, blurb and the notes under "הערות". */
export function parseSupplierInfo(html: string): SupplierInfo {
  // Raayonit's own uploads are absolute links; a relative one (/img/ribuakatan1_04.jpg) is its generic placeholder, not the business's image.
  const found = html.match(/<img[^>]*src="([^"]+)"/)?.[1] ?? ''
  const image = /^https?:\/\//i.test(found) ? found : ''
  const notes = [...html.matchAll(/<div class="bold"[^>]*>הערות<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/g)]
    .flatMap((m) => m[1]!.split(/<br\s*\/?>/i).map((line) => text(line).replace(/^[-–•]\s*/, '')))
    .filter(Boolean)
  return { image, notes, text: text(html) }
}

// A site that does not honour vouchers for now, by the wording Raayonit puts in the row's name or detail pane.
const SUSPENDED_TEXT = /(?:ה?אתר )?(?:לא מכבד תווים|סגור באופן זמני)|סגור לרגל שיפוצים/
// Rows Raayonit lists without a notice that the business says are not honouring vouchers.
const SUSPENDED_NAMES = new Set(['לאונרדו ירושלים', 'לאונרדו אין ים המלח'])
export const isSuspended = (title: string, detailText = ''): boolean => SUSPENDED_TEXT.test(title) || SUSPENDED_TEXT.test(detailText) || SUSPENDED_NAMES.has(title.trim())

/** The branch's name without the "closed" or "take-away only" notice Raayonit appends to it. */
const cleanTitle = (title: string) => title.replace(/\s+-\s+התו תקף[^|]*$/, '').replace(/\*+$/, '').trim()

interface ChainDef { id: string; nameHe: string; nameEn: string; match: RegExp }
// Brands that appear as several rows. A section's rows can all be one chain (SECTION_CHAINS); the rest match by name.
export const NAME_CHAINS: ChainDef[] = [
  { id: 'sharespa', nameHe: 'ShareSpa', nameEn: 'ShareSpa', match: /ShareSpa/i },
  { id: 'holmes', nameHe: 'הולמס פלייס', nameEn: 'Holmes Place', match: /^הולמס פלייס/ },
  { id: 'japan', nameHe: "ג'אפן ג'אפן", nameEn: 'Japan Japan', match: /^ג'[אפ]{2}ן ג'[אפ]{2}ן/ },
  { id: 'max-brenner', nameHe: 'מקס ברנר', nameEn: 'Max Brenner', match: /^מקס ברנר/ },
  { id: 'greg', nameHe: 'גרג', nameEn: 'Greg Cafe', match: /^גרג(?:\s|$)/ },
  { id: 'mexicana', nameHe: 'מקסיקנה', nameEn: 'Mexicana', match: /^מקסיקנה/ },
  { id: 'bleecker', nameHe: 'בליקר בייקרי', nameEn: 'Bleecker Bakery', match: /BLEECKER Bakery/i },
  { id: '4chef', nameHe: '4Chef', nameEn: '4Chef', match: /^4Chef/i },
  { id: 'just-music', nameHe: "ג'אסט מיוזיק", nameEn: 'Just Music', match: /^ג'אסט מיוזיק/ },
  { id: 'cafe-roasters', nameHe: 'קפה רוסטרס', nameEn: 'Cafe Roasters', match: /^קפה רוסטרס/ },
  { id: 'frangelico', nameHe: "פרנג'ליקו", nameEn: 'Frangelico', match: /^פרנג'ליקו/ },
  { id: 'siciliano', nameHe: 'סיציליאנו', nameEn: 'Siciliano', match: /^סיציליאנו/ },
  { id: 'tilia', nameHe: 'טיליה', nameEn: 'Tilia', match: /^טיליה/ },
  { id: 'spa-daniel', nameHe: 'ספא דניאל', nameEn: 'Spa Daniel', match: /^ספא דניאל/ },
  { id: 'mila-spa', nameHe: 'מילה ספא', nameEn: 'Mila Spa', match: /^מילה ספא/ },
  { id: 'la-bourse', nameHe: 'לה בורסה', nameEn: 'La Bourse', match: /^לה בורסה/ },
  { id: 'leonardo', nameHe: 'לאונרדו', nameEn: 'Leonardo Hotels', match: /לאונרדו|יו קורל|יו מג'יק|יו בוטיק|Fattal|פתאל/ },
  { id: 'brown', nameHe: 'בראון', nameEn: 'Brown Hotels', match: /BROWN|בראון/i },
  { id: 'vert', nameHe: 'VERT', nameEn: 'VERT Hotels', match: /^VERT/i },
  { id: 'herods', nameHe: 'הרודס', nameEn: 'Herods Hotels', match: /^הרודס/ },
]
export const SECTION_CHAINS: Record<string, { nameHe: string; nameEn: string }> = {
  '93': { nameHe: 'קפה קפה', nameEn: 'Cafe Cafe' },
  '52': { nameHe: 'פיצה עגבנייה', nameEn: 'Pizza Agvania' },
  '110': { nameHe: 'פיצה סטורי', nameEn: 'Pizza Story' },
  '100': { nameHe: 'ביסקוטי', nameEn: 'Biscotti' },
  '109': { nameHe: 'Mr. Pretzels', nameEn: 'Mr. Pretzels' },
  '83': { nameHe: "באשר פרומז'רי", nameEn: 'Bashar Fromagerie' },
  '16': { nameHe: 'סינמה סיטי', nameEn: 'Cinema City' },
}
/** A listing section's category in our catalogue, from Raayonit's own groupings. Sections without an entry fall back to the name. */
const SECTION_CATEGORY: Record<string, string> = {
  '84': 'Restaurants and Cafes', '15': 'Restaurants and Cafes', '93': 'Restaurants and Cafes', '52': 'Restaurants and Cafes',
  '110': 'Restaurants and Cafes', '100': 'Restaurants and Cafes', '109': 'Restaurants and Cafes', '83': 'Restaurants and Cafes',
  '19': 'Fashion and Shopping', '94': 'Home and Furnishing', '4': 'Pampering Bundles', '78': 'Israel and Global Tourism',
  '20': 'Attractions and Tours', '97': 'Home and Furnishing', '112': 'Beauty and Skincare', '96': 'Fashion and Shopping',
  '16': 'Attractions and Tours', '111': 'Fashion and Shopping',
}

const slug = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x'
const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(36) }

/** The brand a row belongs to: a chain (by section or name) or the business itself. `key` is stable across runs. */
export function brandOfRow(row: Pick<ListingRow, 'title' | 'sectionId' | 'sid'>): { key: string; nameHe: string; nameEn: string; chain: boolean } {
  const title = cleanTitle(row.title)
  const named = NAME_CHAINS.find((c) => c.match.test(title))
  if (named) return { key: `l-${named.id}`, nameHe: named.nameHe, nameEn: named.nameEn, chain: true }
  const section = SECTION_CHAINS[row.sectionId]
  if (section) return { key: `l-s${row.sectionId}`, ...section, chain: true }
  return { key: `l-${row.sid}`, nameHe: title, nameEn: /^[\x20-\x7e]+$/.test(title) ? title : '', chain: false }
}

const cityOf = (address: string) => address.split(',').map((s) => s.trim()).filter(Boolean).pop() ?? ''

export interface ListingBrand extends RaayonitBrand { section: string; kosher: boolean; branchCount: number; suspendedSkipped: number }

/**
 * Groups listing rows into brands, drops suspended rows (by their notice, in the row name or detail pane, or by name), and
 * attaches each brand's own image and notes. `infos` is keyed by the row's `sid`. `skipNames` are brands already covered by a
 * network page (matched on the Hebrew name), so none appears twice.
 */
export function groupListing(rows: ListingRow[], sections: ListingSection[], infos: Map<string, SupplierInfo>, skipNames: ReadonlySet<string> = new Set()): { brands: ListingBrand[]; suspended: string[] } {
  const sectionById = new Map(sections.map((s) => [s.id, s]))
  const suspended: string[] = []
  const groups = new Map<string, { brand: ReturnType<typeof brandOfRow>; rows: ListingRow[]; sectionId: string }>()
  for (const row of rows) {
    if (isSuspended(row.title, infos.get(row.sid)?.text ?? '')) { suspended.push(row.title); continue }
    const brand = brandOfRow(row)
    if (skipNames.has(brand.nameHe.trim().toLowerCase()) || skipNames.has(brand.nameEn.trim().toLowerCase())) continue
    const g = groups.get(brand.key) ?? { brand, rows: [], sectionId: row.sectionId }
    g.rows.push(row)
    groups.set(brand.key, g)
  }
  const brands: ListingBrand[] = []
  for (const { brand, rows: list, sectionId } of groups.values()) {
    const section = sectionById.get(sectionId)
    const restrictions: string[] = []
    const add = (line: string) => { if (line && !restrictions.includes(line)) restrictions.push(line) }
    if (section?.description) add(section.description)
    for (const r of list) {
      const notice = r.title.match(/\s-\s(התו תקף[^|]*)$/)?.[1]
      if (notice) add(notice.replace(/\s+/g, ' ').replace('אווי', 'אוויי').trim())
      for (const note of infos.get(r.sid)?.notes ?? []) add(note)
    }
    const image = list.map((r) => infos.get(r.sid)?.image ?? '').find(Boolean) ?? ''
    const branches: RaayonitBranch[] = list.map((r) => ({ name: cleanTitle(r.title), address: r.address, phone: r.phone, kosher: r.kosher || undefined, city: cityOf(r.address) || undefined }))
    const category = SECTION_CATEGORY[sectionId] ?? inferCategory(brand.nameHe, restrictions)
    brands.push({
      key: brand.key, nameHe: brand.nameHe, nameEn: brand.nameEn, category, logoUrl: image,
      siteUrl: list.map((r) => r.website).find(Boolean) ?? '', restrictions, methods: inferMethods(restrictions), branches,
      section: section?.title ?? '', kosher: branches.some((b) => b.kosher), branchCount: branches.length, suspendedSkipped: 0,
    })
  }
  return { brands, suspended }
}
