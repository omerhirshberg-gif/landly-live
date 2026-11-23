// Dev-time tool: reads Raayonit's whole "תו על" catalogue live (VoucherNum=253): the 74 "רשתות" network pages and the full
// listing (chef restaurants, cafes, chains, spas, hotels, attractions ...) with each row's own detail pane. Drops suspended
// sites, groups chain branches into one brand, saves every brand's own image (sharp, PNG) into public/images/raayonit-brands/
// and landly-mobile/assets/raayonit-brands/, and writes lib/inventory/raayonitCatalog.snapshot.json plus the native image map.
// Bundle then run:  npx esbuild scripts/raayonit-scrape.mts --bundle --platform=node --format=esm --outfile=$TMP/scrape.mjs && node $TMP/scrape.mjs [--dry]
import { mkdirSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import sharp from 'sharp'
import { parseNetworkIndex, parseNetworkPage, showNetworksUrl, networkUrl, RAAYONIT_BASE, RAAYONIT_VOUCHER_NUM, type RaayonitBrand } from '../lib/inventory/raayonitCatalog'
import { applyListingKosher, groupListing, parseListingRows, parseListingSections, parseSupplierInfo, type SupplierInfo } from '../lib/inventory/raayonitListing'

const dry = process.argv.includes('--dry')
const UA = 'Mozilla/5.0 (compatible; GoLandlyCatalogSync)'
const get = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, { ...init, headers: { 'user-agent': UA, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res
}
async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  const queue = [...items]
  await Promise.all(Array.from({ length: n }, async () => { for (let i = queue.shift(); i !== undefined; i = queue.shift()) out.push(await fn(i)) }))
  return out
}

// 1. Network pages.
const index = parseNetworkIndex(await (await get(showNetworksUrl())).text())
const networks = (await pool(index, 4, async (item) => {
  try { return parseNetworkPage(await (await get(networkUrl(item.key))).text(), item.key, item.logoUrl) } catch (e) { console.warn('network failed', item.key, String(e)); return null }
})).filter((b): b is RaayonitBrand => !!b).sort((a, b) => Number(a.key) - Number(b.key))

// 2. The full listing and each row's detail pane.
const listingHtml = await (await get(`${RAAYONIT_BASE}inPage.asp?catID=3&VoucherNum=${RAAYONIT_VOUCHER_NUM}`)).text()
const rows = parseListingRows(listingHtml)
const sections = parseListingSections(listingHtml)
const infos = new Map<string, SupplierInfo>()
await pool(rows, 4, async (row) => {
  try {
    const body = new URLSearchParams({ rid: row.rowId, vid: String(RAAYONIT_VOUCHER_NUM), sid: row.sid })
    const res = await get(`${RAAYONIT_BASE}SupplierVoucherInfo.asp`, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } })
    infos.set(row.sid, parseSupplierInfo(await res.text()))
  } catch (e) { console.warn('detail failed', row.sid, String(e)) }
})
const skip = new Set(networks.flatMap((n) => [n.nameHe, n.nameEn].filter(Boolean).map((s) => s.trim().toLowerCase())))
const { brands: listed, suspended } = groupListing(rows, sections, infos, skip)

// A network page carries no kosher flag; the listing rows skipped above do, so bring them onto the network brands' branches.
const all = [...applyListingKosher(networks, rows), ...listed]
const branchTotal = all.reduce((n, b) => n + b.branches.length, 0)
const withImage = all.filter((b) => b.logoUrl).length
console.log(JSON.stringify({ networks: networks.length, listingRows: rows.length, sections: sections.length, detailsFetched: infos.size, suspendedSkipped: suspended, listingBrands: listed.length, brands: all.length, branches: branchTotal, brandsWithOwnImage: withImage, kosherBrands: listed.filter((b) => b.kosher).length }, null, 1))
if (dry) process.exit(0)

// 3. Images: each brand's own, optimized, into the web and native asset folders.
const webDir = 'public/images/raayonit-brands'
const nativeDir = 'landly-mobile/assets/raayonit-brands'
for (const dir of [webDir, nativeDir]) { rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true }) }
const saved = new Map<string, string>()
const done = await pool(all, 4, async (brand) => {
  if (!brand.logoUrl) return { key: brand.key, file: '' }
  try {
    const bytes = Buffer.from(await (await get(brand.logoUrl)).arrayBuffer())
    const file = `${brand.key.replace(/[^\w-]+/g, '')}.png`
    const png = await sharp(bytes).resize({ width: 360, height: 360, fit: 'inside', withoutEnlargement: true }).png({ palette: true, quality: 85, compressionLevel: 9 }).toBuffer()
    writeFileSync(`${webDir}/${file}`, png)
    writeFileSync(`${nativeDir}/${file}`, png)
    return { key: brand.key, file }
  } catch (e) { console.warn('image failed', brand.key, String(e)); return { key: brand.key, file: '' } }
})
for (const d of done) if (d.file) saved.set(d.key, d.file)
const final = all.map((b) => ({ ...b, ...(saved.has(b.key) ? { logoFile: saved.get(b.key) } : {}) }))
writeFileSync('lib/inventory/raayonitCatalog.snapshot.json', JSON.stringify({ source: 'raayonit.co.il VoucherNum=253 (networks + full listing)', generatedAt: new Date().toISOString(), brands: final }, null, 1))

// 4. The native image map: Metro needs static requires, so every saved file is listed.
const files = readdirSync(nativeDir).sort()
writeFileSync('landly-mobile/src/lib/raayonitBrandImages.ts', `// Generated by scripts/raayonit-scrape.mts: each Raayonit brand's own image, bundled with the app (Metro needs static requires).
import type { ImageSourcePropType } from 'react-native'

const IMAGES: Record<string, ImageSourcePropType> = {
${files.map((f) => `  '${f}': require('../../assets/raayonit-brands/${f}'),`).join('\n')}
}

/** The bundled image for a card's businessLogoUrl (…/images/raayonit-brands/{file}); null when it isn't one of ours. */
export function bundledBrandImage(url: string | undefined | null): ImageSourcePropType | null {
  const file = url?.match(/\\/images\\/raayonit-brands\\/([\\w-]+\\.png)(?:\\?|$)/)?.[1]
  return (file && IMAGES[file]) || null
}
`)
console.log('saved images', saved.size, 'of', all.length, 'existing', existsSync(webDir))
