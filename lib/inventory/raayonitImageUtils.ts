// Pure helpers of the Raayonit image build (scripts/raayonit-images.mts), kept here so they are unit tested.
import sharp from 'sharp'
import { normalizeWebsiteUrl } from '@/lib/offers/contact'

/** The business's website as a clean link (shared with the offer: lib/offers/contact.ts); '' when there is none. */
export const fixSite = normalizeWebsiteUrl
/** The page itself, then its origin, then the other scheme and the www / bare host: a deep link often has no meta image, or blocks a script. */
export function siteVariants(site: string): string[] {
  const out = new Set<string>([site])
  try {
    const u = new URL(site)
    out.add(u.origin + '/')
    for (const scheme of ['https:', 'http:']) for (const host of [u.hostname, u.hostname.startsWith('www.') ? u.hostname.slice(4) : `www.${u.hostname}`]) out.add(`${scheme}//${host}/`)
  } catch { /* keep what we have */ }
  return [...out]
}
/** Drops a flat white (or transparent) border, so no margin is baked into the file; an image with nothing to trim comes back unchanged. */
export async function trimMargins(flat: Buffer): Promise<Buffer> {
  try { return await sharp(flat).trim({ background: '#ffffff', threshold: 14 }).toBuffer() } catch { return flat }
}

/** A white logo on a transparent field (a light-on-dark mark): flattened on white it would vanish. */
async function isLightOnTransparent(bytes: Buffer): Promise<boolean> {
  const { data, info } = await sharp(bytes).ensureAlpha().resize(64, 64, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true })
  let weight = 0, light = 0, transparent = 0
  for (let i = 0; i < info.width * info.height; i++) {
    const a = data[i * 4 + 3]! / 255
    if (a < 0.05) { transparent++; continue }
    weight += a
    light += a * (data[i * 4]! + data[i * 4 + 1]! + data[i * 4 + 2]!) / 3
  }
  return transparent > 0 && weight > 0 && light / weight >= 235
}

/**
 * A logo on a plain white field loses the field: white becomes transparent (alpha from how far each pixel is from white, colour recovered
 * from it), so the card's blurred backdrop shows through instead of a white rectangle. Anything not on white is returned unchanged.
 */
export async function whiteToTransparent(flatWhite: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(flatWhite).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  // A field of white: most of the border is white (a tight trim can leave a letter touching a corner or an edge).
  let border = 0, whiteBorder = 0
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (x !== 0 && y !== 0 && x !== info.width - 1 && y !== info.height - 1) continue
    const i = (y * info.width + x) * 4
    border++
    if (data[i]! >= 245 && data[i + 1]! >= 245 && data[i + 2]! >= 245) whiteBorder++
  }
  if (whiteBorder / border < 0.4) return flatWhite
  const out = Buffer.from(data)
  for (let i = 0; i < info.width * info.height; i++) {
    const o = i * 4
    const alpha = 255 - Math.min(data[o]!, data[o + 1]!, data[o + 2]!)
    if (alpha === 0) { out[o] = out[o + 1] = out[o + 2] = 255; out[o + 3] = 0; continue }
    for (let c = 0; c < 3; c++) out[o + c] = Math.max(0, Math.min(255, Math.round(((data[o + c]! - (255 - alpha)) * 255) / alpha)))
    out[o + 3] = alpha
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
}

/** A logo or wordmark at its own trimmed shape (no white stage), longest edge 720: the cards show it whole over the ambient backdrop. */
export async function makeLogo(bytes: Buffer): Promise<Buffer> {
  let trimmed = bytes
  try { trimmed = await sharp(bytes).trim({ threshold: 14 }).toBuffer() } catch { /* nothing to trim */ }
  const light = await isLightOnTransparent(trimmed)
  const flat = await sharp(trimmed).flatten({ background: light ? '#1E293B' : '#ffffff' }).toBuffer()
  const cleaned = light ? flat : await trimMargins(flat)
  const final = light ? cleaned : await whiteToTransparent(cleaned)
  return sharp(final).resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true }).png({ palette: true, quality: 90, compressionLevel: 9 }).toBuffer()
}

/**
 * A photograph keeps its own shape, minus any baked white border: a landscape one (ratio 1.2 or more) is cropped to 3:2 and fills its frame
 * edge to edge; a portrait or square one is NOT padded to 3:2. It stays at its natural ratio, longest edge 720, so the apps and the site show
 * it whole in front of a blurred copy of itself (lib/offers/imageFit.ts).
 */
export async function makePhoto(bytes: Buffer, w: number): Promise<Buffer> {
  const flat = await trimMargins(await sharp(bytes).flatten({ background: '#ffffff' }).toBuffer())
  const meta = await sharp(flat).metadata()
  const ratio = (meta.width ?? 1) / (meta.height ?? 1)
  if (ratio >= 1.2 && w >= 480) return sharp(flat).resize(720, 480, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  return sharp(flat).resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toBuffer()
}

/**
 * Where a brand image may NOT come from: social platforms (and their CDNs), whose pictures belong to their posters, and stock agencies, whose
 * pictures are watermarked and licensed per use. Only the business's own site is a source (the apex or any subdomain of a blocked host is blocked).
 */
const BLOCKED_HOSTS = [
  'instagram.com', 'cdninstagram.com', 'facebook.com', 'fbcdn.net', 'fb.com', 'fb.me', 'tiktok.com', 'tiktokcdn.com', 'pinterest.com', 'pinimg.com',
  'twitter.com', 'twimg.com', 'x.com', 'linkedin.com', 'licdn.com', 'youtube.com', 'youtu.be', 'ytimg.com',
  'shutterstock.com', 'gettyimages.com', 'istockphoto.com', 'alamy.com', 'depositphotos.com',
]
export function isBlockedImageSource(url: string): boolean {
  let host = ''
  try { host = new URL(url).hostname.toLowerCase() } catch { return true } // not a URL: not a source
  return BLOCKED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
}
