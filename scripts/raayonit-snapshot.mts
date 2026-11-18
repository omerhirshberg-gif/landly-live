// Dev-time tool: reads Raayonit's "תו על" network pages (crawled into a folder) plus the index, downloads each
// brand's logo into public/images/raayonit-brands/ and writes lib/inventory/raayonitCatalog.snapshot.json, the
// bundled copy the admin sync falls back on. Usage: node scripts/raayonit-snapshot.mts <pagesDir> <indexHtml>
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { logoFileName, parseNetworkIndex, parseNetworkPage } from '../lib/inventory/raayonitCatalog.ts'

const [pagesDir, indexFile] = process.argv.slice(2)
if (!pagesDir || !indexFile) throw new Error('usage: raayonit-snapshot.mts <pagesDir> <indexHtml>')
const index = parseNetworkIndex(readFileSync(indexFile, 'utf8'))
const outDir = 'public/images/raayonit-brands'
mkdirSync(outDir, { recursive: true })
const brands = []
for (const item of index) {
  const file = join(pagesDir, `net_${item.key}.html`)
  if (!existsSync(file)) { console.warn('missing page', item.key); continue }
  const brand = parseNetworkPage(readFileSync(file, 'utf8'), item.key, item.logoUrl)
  if (!brand) { console.warn('no brand in page', item.key); continue }
  let logoFile = ''
  if (brand.logoUrl) {
    const name = logoFileName(brand.key, brand.logoUrl)
    try {
      if (!existsSync(join(outDir, name))) {
        const res = await fetch(brand.logoUrl, { signal: AbortSignal.timeout(20000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        writeFileSync(join(outDir, name), Buffer.from(await res.arrayBuffer()))
      }
      logoFile = name
    } catch (err) {
      console.warn('logo failed', brand.key, String(err))
    }
  }
  brands.push({ ...brand, ...(logoFile ? { logoFile } : {}) })
}
writeFileSync('lib/inventory/raayonitCatalog.snapshot.json', JSON.stringify({ source: 'raayonit.co.il VoucherNum=253', generatedAt: new Date().toISOString(), brands }, null, 1))
console.log('brands', brands.length, 'branches', brands.reduce((n, b) => n + b.branches.length, 0), 'logos', readdirSync(outDir).length)
