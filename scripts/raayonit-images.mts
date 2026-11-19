// Builds every Raayonit brand's picture: its image from Raayonit (any branch's detail pane), else the business's own website
// (og:image / twitter:image / apple-touch-icon), else nothing (the card then shows the small Raayonit mark). Each image is
// classed as a LOGO (trimmed to its own shape, longest edge 720, PNG, no white stage) or a PHOTO (3:2 cover crop 720x480, JPEG;
// a small photo sits sharp over a blurred copy of itself instead of being stretched). Writes web + native assets, the native
// image map, and logoFile / logoKind into lib/inventory/raayonitCatalog.snapshot.json. Raw downloads are cached in $RAAYONIT_RAW.
// Bundle then run: npx esbuild scripts/raayonit-images.mts --bundle --platform=node --format=esm --packages=external --alias:@=. --outfile=.img-tmp.mjs && RAAYONIT_RAW=<dir> node .img-tmp.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { fixSite, siteVariants, makeLogo, makePhoto, isBlockedImageSource } from '../lib/inventory/raayonitImageUtils'
import { finalizeCatalog } from '../lib/inventory/raayonitSanitize'
import { applyCanonical, CANONICAL_EXTRA_BRANDS, NO_IMAGE_BRAND_KEYS } from '../lib/inventory/raayonitCanonicalCatalog'
import type { RaayonitBrand } from '../lib/inventory/raayonitCatalog'

const WEB = 'public/images/raayonit-brands'
const NATIVE = 'landly-mobile/assets/raayonit-brands'
const RAW = process.env.RAAYONIT_RAW ?? '.raayonit-raw'
// Wordmarks the colour test cannot tell from a photo (a logo filling a tiny frame on a busy field).
const FORCE_LOGO = /סטאי|setai|walk in|mexicana|toys|kitan|guess|שילב|צומת ספרים|4chef|afe|לחם ארז/i
// Photographs the colour test reads as a logo (a pale studio shot on a flat field): they are shown whole over a blurred copy, never padded like a wordmark.
const FORCE_PHOTO = /^VERT |clarins|קלארינס|crowne|קראון|botanica|בוטניקה/i
// Brands whose own sites refuse a script (or have no usable meta image): a direct image link, tried after Raayonit and the site. Add a row when a brand still shows the Raayonit mark.
const SETAI_LOGO = 'https://thesetaihotels.com/wp-content/uploads/2022/11/Logo-group-en3.svg' // the official vector logo of both The Setai hotels (given by the owner)
const IMAGE_OVERRIDES: Record<string, string[]> = { 'l-5062': [SETAI_LOGO], 'l-10319': [SETAI_LOGO] }
/** Raayonit's own "no picture" placeholders and UI chrome are not a brand's image: tiny, or one of the shared files. */
const GENERIC_SRC = /(no[-_]?image|placeholder|default[-_]?(img|image|logo)|raayonit[-_.]?logo|spacer|blank)\./i
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
type Snap = RaayonitBrand & { logoFile?: string; logoKind?: 'logo' | 'photo'; logoSource?: string }
const file = JSON.parse(readFileSync('lib/inventory/raayonitCatalog.snapshot.json', 'utf8')) as { brands: Snap[]; [k: string]: unknown }
// Canonical brands the scrape misses (U Hotels) are built and stored in the snapshot like any other.
file.brands = [...file.brands, ...CANONICAL_EXTRA_BRANDS.filter((x) => !file.brands.some((b) => b.key === x.key))]
const brands = finalizeCatalog(applyCanonical(file.brands))
mkdirSync(RAW, { recursive: true })

const fetchBytes = async (url: string, ms = 15_000): Promise<{ bytes: Buffer; type: string } | null> => {
  // Never a social network or a stock agency, neither as the link nor after a redirect.
  if (isBlockedImageSource(url)) return null
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'image/*,text/html;q=0.8,*/*;q=0.5' }, redirect: 'follow', signal: AbortSignal.timeout(ms) })
    if (!res.ok || isBlockedImageSource(res.url || url)) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    return bytes.length > 0 && bytes.length < 6_000_000 ? { bytes, type: res.headers.get('content-type') ?? '' } : null
  } catch { return null }
}
/** og:image, twitter:image, then icons, resolved against the page, best first. */
function candidates(html: string, base: string): { url: string; icon: boolean }[] {
  const out: { url: string; icon: boolean }[] = []
  const add = (v: string | undefined, icon: boolean) => { if (!v) return; try { out.push({ url: new URL(v.replace(/&amp;/g, '&'), base).toString(), icon }) } catch { /* skip */ } }
  const meta = (name: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'))?.[1] ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`, 'i'))?.[1]
  add(meta('og:image:secure_url'), false); add(meta('og:image'), false); add(meta('twitter:image'), false)
  // A header or brand logo drawn in the page: its first few <img> whose class, id, alt or file name says "logo".
  let imgs = 0
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    if (imgs >= 3 || !/logo/i.test(m[0])) continue
    const src = m[0].match(/\bsrc=["']([^"']+)["']/i)?.[1]
    if (src && !src.startsWith('data:')) { add(src, true); imgs++ }
  }
  for (const m of html.matchAll(/<link[^>]+rel=["'][^"']*(apple-touch-icon[^"']*|icon)["'][^>]*>/gi)) add(m[0].match(/href=["']([^"']+)["']/i)?.[1], true)
  return out.filter((c) => !/\.svg(\?|$)/i.test(c.url) && !/\.ico(\?|$)/i.test(c.url) && !GENERIC_SRC.test(c.url))
}
async function usable(bytes: Buffer): Promise<{ w: number; h: number } | null> {
  try { const m = await sharp(bytes).metadata(); return m.width && m.height && m.width >= 64 && m.height >= 48 ? { w: m.width, h: m.height } : null } catch { return null }
}

/** A logo sits on one flat background colour (white, or its brand's); a photo has no such field. Tested on the corners and the share of pixels near them. */
async function looksLikeLogo(bytes: Buffer): Promise<boolean> {
  const N = 64
  const { data } = await sharp(bytes).flatten({ background: '#ffffff' }).resize(N, N, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const px = (x: number, y: number) => [data[(y * N + x) * 3]!, data[(y * N + x) * 3 + 1]!, data[(y * N + x) * 3 + 2]!]
  const corner = (cx: number, cy: number) => { const sum = [0, 0, 0]; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) px(cx + x, cy + y).forEach((v, c) => (sum[c]! += v / 16)); return sum }
  const corners = [corner(0, 0), corner(N - 4, 0), corner(0, N - 4), corner(N - 4, N - 4)]
  const bg = [0, 1, 2].map((c) => corners.map((k) => k[c]!).sort((x, y) => x - y)[1]!)
  const dist = (p: number[], q: number[]) => Math.max(Math.abs(p[0]! - q[0]!), Math.abs(p[1]! - q[1]!), Math.abs(p[2]! - q[2]!))
  const agree = corners.filter((k) => dist(k, bg) < 36).length >= 3
  let near = 0
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (dist(px(x, y), bg) < 36) near++
  const plain = bg.every((v) => v >= 225) || bg.every((v) => v <= 30) // a white or black field: a logo that fills its frame still has one
  if (agree && near / (N * N) >= (plain ? 0.15 : 0.4)) return true
  // A logo may touch its edges; it is still drawn with a handful of flat colours, a photo with hundreds.
  const bins = new Map<number, number>()
  for (let i = 0; i < N * N; i++) { const k = ((data[i * 3]! >> 5) << 6) | ((data[i * 3 + 1]! >> 5) << 3) | (data[i * 3 + 2]! >> 5); bins.set(k, (bins.get(k) ?? 0) + 1) }
  const top = [...bins.values()].sort((x, y) => y - x).slice(0, 5).reduce((sum, v) => sum + v, 0)
  let white = 0
  for (let i = 0; i < N * N; i++) if (data[i * 3]! > 232 && data[i * 3 + 1]! > 232 && data[i * 3 + 2]! > 232) white++
  return top / (N * N) >= 0.86 || (white / (N * N) >= 0.3 && top / (N * N) >= 0.72)
}

/** The first usable og:image / logo / icon on a business's own site (any social or stock host is refused by fetchBytes). */
async function fromSite(site: string): Promise<{ bytes: Buffer; source: string; icon: boolean } | null> {
  for (const page of site ? siteVariants(site) : []) {
    const html = await fetchBytes(page, 12_000)
    if (!html || !/html|text/i.test(html.type + 'html')) continue
    for (const c of candidates(html.bytes.toString('utf8'), page)) {
      const r = await fetchBytes(c.url, 12_000)
      const meta = r ? await usable(r.bytes) : null
      if (r && meta && meta.w >= (c.icon ? 120 : 200) && meta.h >= 100) return { bytes: r.bytes, source: `${c.icon ? 'icon' : 'site'}:${c.url}`, icon: c.icon }
    }
  }
  return null
}
const PLACES_KEY = process.env.GOOGLE_MAPS_SERVER_API_KEY
/** The official website Google Places lists for a business (Text Search, websiteUri field only); '' when none, or when it is a social page. */
async function placesWebsite(query: string): Promise<string> {
  if (!PLACES_KEY || !query) return ''
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': PLACES_KEY, 'X-Goog-FieldMask': 'places.displayName,places.websiteUri' },
      body: JSON.stringify({ textQuery: query, regionCode: 'IL', languageCode: 'he', pageSize: 1 }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return ''
    const uri = ((await res.json()) as { places?: { websiteUri?: string }[] }).places?.[0]?.websiteUri ?? ''
    return uri && !isBlockedImageSource(uri) ? uri : ''
  } catch { return '' }
}
const missingBefore = new Set(file.brands.filter((b) => !b.logoFile).map((b) => b.key))
const recovered: { name: string; key: string; source: string; origin: string }[] = []
for (const dir of [WEB, NATIVE]) { rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true }) }
const result = new Map<string, { file: string; kind: 'logo' | 'photo'; source: string }>()
const stats = { raayonit: 0, site: 0, none: 0, logo: 0, photo: 0 }
const queue = [...brands]
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let b = queue.shift(); b; b = queue.shift()) {
    if (NO_IMAGE_BRAND_KEYS.includes(b.key)) continue // no picture of its own: the card shows the Raayonit mark
    const safe = b.key.replace(/[^\w-]+/g, '')
    let bytes: Buffer | null = null, source = '', icon = false
    const rawFile = `${RAW}/${safe}.bin`
    if (existsSync(rawFile)) { bytes = readFileSync(rawFile); source = readFileSync(`${rawFile}.src`, 'utf8').trim(); icon = source.startsWith('icon:') }
    if (!bytes && /^https?:\/\//i.test(b.logoUrl)) { const r = await fetchBytes(b.logoUrl); if (r && (await usable(r.bytes))) { bytes = r.bytes; source = 'raayonit' } }
    let origin = source.startsWith('user_provided:') ? 'user_provided' : 'raayonit_directory'
    if (!bytes) {
      const got = await fromSite(fixSite(b.siteUrl))
      if (got) { ({ bytes, source, icon } = got); origin = 'official_website' }
    }
    // The directory's own site gave nothing: ask Google Places for the business's official website (its listing's websiteUri) and look there.
    // Only that link is used: Google's own listing photos are not downloaded (their terms forbid storing them), and no social page is ever a source.
    if (!bytes) {
      const found = await placesWebsite(`${b.nameHe} ${b.nameEn}`.trim())
      if (found && found !== fixSite(b.siteUrl)) {
        const got = await fromSite(found)
        if (got) { ({ bytes, source, icon } = got); origin = 'google_business_listing_website' }
      }
    }
    if (!bytes) {
      for (const link of IMAGE_OVERRIDES[b.key] ?? []) {
        const r = await fetchBytes(link)
        // A vector logo is drawn once, crisp, at 1440px wide (the PNG then trims and fits like any other logo).
        const body = r && /<svg[\s>]/i.test(r.bytes.subarray(0, 2000).toString('utf8')) ? await sharp(r.bytes, { density: 300 }).resize({ width: 1440 }).png().toBuffer() : r?.bytes
        if (body && (await usable(body))) { bytes = body; source = `site:${link}`; origin = 'official_website'; break }
      }
    }
    if (!bytes) { stats.none++; continue }
    writeFileSync(rawFile, bytes); writeFileSync(`${rawFile}.src`, source)
    try {
      const meta = (await usable(bytes))!
      const name = `${b.nameHe} ${b.nameEn}`
      const kind: 'logo' | 'photo' = FORCE_PHOTO.test(name) ? 'photo' : icon || FORCE_LOGO.test(name) || (await looksLikeLogo(bytes)) ? 'logo' : 'photo'
      const out = kind === 'logo' ? await makeLogo(bytes) : await makePhoto(bytes, meta.w)
      const fileName = `${safe}.${kind === 'logo' ? 'png' : 'jpg'}`
      writeFileSync(`${WEB}/${fileName}`, out); writeFileSync(`${NATIVE}/${fileName}`, out)
      result.set(b.key, { file: fileName, kind, source })
      if (missingBefore.has(b.key)) recovered.push({ name: b.nameHe || b.nameEn, key: b.key, source: source.replace(/^[a-z]+:/, ''), origin })
      source === 'raayonit' ? stats.raayonit++ : stats.site++
      stats[kind]++
    } catch (e) { console.warn('image failed', b.key, String(e)); stats.none++ }
  }
}))

// Snapshot: every raw brand takes the result of the brand it was merged into (same key after finalize), the rest lose a stale file.
file.brands = file.brands.map((b) => { const { logoFile: _f, logoKind: _k, logoSource: _s, ...rest } = b; const r = result.get(b.key); return r ? { ...rest, logoFile: r.file, logoKind: r.kind, logoSource: r.source.split(':')[0] } : rest })
writeFileSync('lib/inventory/raayonitCatalog.snapshot.json', JSON.stringify(file, null, 1))
const files = readdirSync(NATIVE).sort()
writeFileSync('landly-mobile/src/lib/raayonitBrandImages.ts', `// Generated by scripts/raayonit-images.mts: each Raayonit brand's own image, bundled with the app (Metro needs static requires).
import type { ImageSourcePropType } from 'react-native'
import { brandImageFile, siteImageFile } from './imageSource'

const IMAGES: Record<string, ImageSourcePropType> = {
${files.map((f) => `  '${f}': require('../../assets/raayonit-brands/${f}'),`).join('\n')}
}

// The site's own offer pictures (public/images/raayonit), bundled because a stored relative path is no link a device can fetch.
const SITE_IMAGES: Record<string, ImageSourcePropType> = {
  'super-tav-multi-chain.jpg': require('../../assets/images/super-tav-multi-chain.jpg'),
}

/**
 * The bundled image for a card's businessLogoUrl or imageUrl (…/images/raayonit-brands/{file}), whatever the host, leading slash,
 * query or letter case; the other extension is tried when the exact file is not bundled. Null when it isn't one of ours.
 */
export function bundledBrandImage(url: string | undefined | null): ImageSourcePropType | null {
  const site = siteImageFile(url)
  if (site) return SITE_IMAGES[site] ?? null
  const file = brandImageFile(url)
  if (!file) return null
  return IMAGES[file] ?? IMAGES[file.replace(/\\.(png|jpe?g|webp)$/, (_, ext: string) => (ext === 'png' ? '.jpg' : '.png'))] ?? null
}
`)
console.log(JSON.stringify({ brands: brands.length, ...stats, withOwnImage: result.size, fallback: brands.length - result.size, fallbackNames: brands.filter((b) => !result.has(b.key)).map((b) => b.nameHe) }))

// Audit trail: every image recovered for a brand that had none, with its source and where it came from (docs/IMAGE_LICENSES.md).
const marker = '## Raayonit brand images recovered from official sites'
const docPath = 'docs/IMAGE_LICENSES.md'
const doc = readFileSync(docPath, 'utf8')
const base = doc.includes(marker) ? doc.slice(0, doc.indexOf(marker)).trimEnd() : doc.trimEnd()
// Rows from earlier runs stay (a brand recovered once is no longer 'missing' on the next run), unless this run re-recovered the same key.
const kept = (doc.includes(marker) ? doc.slice(doc.indexOf(marker)).split('\n') : []).filter((l) => /^\| .+ \| `[^`]+` \| /.test(l) && !recovered.some((r) => l.includes(`\`${r.key}\``)))
const rows = [...kept, ...recovered.sort((a, b) => a.key.localeCompare(b.key)).map((r) => `| ${r.name.replace(/\|/g, '/')} | \`${r.key}\` | ${r.source} | ${r.origin} |`)]
writeFileSync(docPath, `${base}\n\n${marker}\n\nOnly the business's own website (\`official_website\`, or the website its Google Business listing names: \`google_business_listing_website\`) is a source. Social platforms (Instagram, Facebook, TikTok, Pinterest, X, LinkedIn, YouTube and their CDNs) and stock agencies are refused by \`isBlockedImageSource\` (lib/inventory/raayonitImageUtils.ts). Google's own listing photos are not downloaded.\n\n${rows.length ? '| Business | Key | Source URL | Origin |\n|---|---|---|---|\n' + rows.join('\n') : '_No image was recovered in the last run: the brands still without one show the small Raayonit mark._'}\n`)
