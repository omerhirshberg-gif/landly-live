// One-off, idempotent patch of lib/inventory/raayonitCatalog.snapshot.json: sets `kosher: true` on the branches Raayonit's live listing marks kosher
// (a business with its own "רשתות" network page lost them when the snapshot was built). It only ever adds `true`, touches no other field, and makes ONE
// request to raayonit.co.il (the listing page), or none with --html <saved page>.
//   --dry   print what would change and write nothing
// Bundle then run: npx esbuild scripts/raayonit-kosher-snapshot.mts --bundle --platform=node --format=esm --packages=external --alias:@=. \
//   --alias:server-only=./scripts/lib/emptyModule.mjs --alias:next/server=./scripts/lib/nextServerStub.mjs --outfile=$TMP/kosher-snapshot.mjs && node $TMP/kosher-snapshot.mjs [--dry] [--html page.html]
import { readFileSync, writeFileSync } from 'node:fs'
import { applyListingKosher, parseListingRows } from '../lib/inventory/raayonitListing'
import { indexUrl, type RaayonitBrand } from '../lib/inventory/raayonitCatalog'

const FILE = 'lib/inventory/raayonitCatalog.snapshot.json'
const args = process.argv.slice(2)
const htmlFile = args[args.indexOf('--html') + 1]
const html = args.includes('--html') && htmlFile ? readFileSync(htmlFile, 'utf8') : await (async () => {
  const res = await fetch(indexUrl(), { headers: { 'user-agent': 'Mozilla/5.0 (compatible; GoLandlyCatalogSync)' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
})()
const original = readFileSync(FILE, 'utf8')
const data = JSON.parse(original) as { brands: RaayonitBrand[] }
const patched = applyListingKosher(data.brands, parseListingRows(html))
const changed = patched.flatMap((b, i) => {
  const before = data.brands[i]!.branches.filter((x) => x.kosher).length
  const after = b.branches.filter((x) => x.kosher).length
  return after !== before ? [{ key: b.key, name: b.nameHe, before, after, total: b.branches.length }] : []
})
console.log(`${changed.length} brand(s) gain kosher branches (${changed.reduce((n, c) => n + c.after - c.before, 0)} branches)`)
for (const c of changed) console.log(`  ${c.key} ${c.name}: ${c.before} -> ${c.after} of ${c.total}`)
if (args.includes('--dry') || changed.length === 0) { console.log(args.includes('--dry') ? 'Dry run only: nothing was written.' : 'Already up to date.'); process.exit(0) }
data.brands = patched
const out = JSON.stringify(data, null, 1)
writeFileSync(FILE, original.endsWith('\n') ? `${out}\n` : out)
console.log(`Wrote ${FILE}`)
