// Builds lib/offers/raayonitCategoryMembership.json: for every business that Raayonit's VoucherNum=253 directory lists under more than one
// category (a listing section and/or the "רשתות" network index), the full list of those categories, primary first. READ-ONLY toward Raayonit
// (one page request, or --html <file> to reuse a saved copy) and it touches no Firestore: the table is committed and read at runtime.
//   --check   compare with the committed table and exit 1 on any difference (writes nothing)
// Bundle then run: npx esbuild scripts/raayonit-category-membership.mts --bundle --platform=node --format=esm --packages=external --alias:@=. \
//   --alias:server-only=./scripts/lib/emptyModule.mjs --alias:next/server=./scripts/lib/nextServerStub.mjs --outfile=$TMP/membership.mjs && node $TMP/membership.mjs [--html page.html] [--check]
import { readFileSync, writeFileSync } from 'node:fs'
import { bundledCatalog } from '../lib/inventory/raayonitCatalogSync'
import { finalizeCatalog } from '../lib/inventory/raayonitSanitize'
import { identitiesOf } from '../lib/inventory/raayonitLiveDiff'
import { brandOfRow, isSuspended, parseListingRows } from '../lib/inventory/raayonitListing'
import { indexUrl, parseNetworkIndex } from '../lib/inventory/raayonitCatalog'
import { RAAYONIT_CATEGORY_IDS, SECTION_CATEGORY_ID, raayonitCategoryOf } from '../lib/offers/raayonitCategories'
import byKey from '../lib/offers/raayonitCategoryByKey.json'

const OUT = 'lib/offers/raayonitCategoryMembership.json'
const args = process.argv.slice(2)
const htmlFile = args[args.indexOf('--html') + 1]
const html = args.includes('--html') && htmlFile ? readFileSync(htmlFile, 'utf8') : await (async () => {
  const res = await fetch(indexUrl(), { headers: { 'user-agent': 'Mozilla/5.0 (compatible; GoLandlyCatalogSync)' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
})()

const brands = finalizeCatalog(bundledCatalog())
const byKeyBrand = new Map(brands.map((b) => [b.key, b]))
const byIdentity = new Map<string, string>()
for (const b of brands) for (const id of identitiesOf(b.nameHe, b.nameEn)) if (!byIdentity.has(id)) byIdentity.set(id, b.key)
const sections = new Map<string, Set<string>>()
const add = (key: string, category: string) => (sections.get(key) ?? sections.set(key, new Set()).get(key)!).add(category)
for (const row of parseListingRows(html)) {
  if (isSuspended(row.title)) continue
  const listed = brandOfRow(row)
  const key = byKeyBrand.has(listed.key) ? listed.key : identitiesOf(listed.nameHe, listed.nameEn).map((i) => byIdentity.get(i)).find(Boolean)
  const category = SECTION_CATEGORY_ID[row.sectionId]
  if (key && category) add(key, category)
}
for (const { key } of parseNetworkIndex(html)) if (byKeyBrand.has(key)) add(key, 'networks')

const table: Record<string, string[]> = {}
for (const [key, found] of [...sections].sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }))) {
  if (found.size < 2) continue
  const brand = byKeyBrand.get(key)!
  const primary = raayonitCategoryOf({ sourceKey: `raayonit:${key}`, brandName: brand.nameHe }, byKey as Record<string, string>)
  table[key] = [primary, ...RAAYONIT_CATEGORY_IDS.filter((id) => id !== primary && found.has(id))]
}
const next = JSON.stringify(table, null, 1) + '\n'
console.log(`${Object.keys(table).length} businesses are listed under more than one category`)
if (args.includes('--check')) {
  const same = readFileSync(OUT, 'utf8') === next
  console.log(same ? 'membership table is up to date' : 'membership table differs from the live directory')
  process.exit(same ? 0 : 1)
}
writeFileSync(OUT, next)
