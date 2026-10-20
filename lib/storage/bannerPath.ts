// Offer banners uploaded from the admin live at banners/{uuid}.jpg in the
// project's Storage bucket (storage.rules: public read, no client writes).
// Pure helpers shared by the upload route, the offer routes' cleanup and the
// unit tests.

export const BANNER_PREFIX = 'banners/'
/** Server-side cap; the admin compresses to a ≤1600px JPEG of ~150–350KB first. */
export const MAX_BANNER_BYTES = 2 * 1024 * 1024

/** The Firebase Storage download URL for an object (the token makes it readable by any <img>). */
export function storageDownloadUrl(bucket: string, path: string, token: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
}

/**
 * The banners/… object behind one of our own download URLs, or null for
 * anything else (an external pasted link, another bucket, another folder):
 * only our own uploads are ever deleted.
 */
export function bannerPathFromUrl(url: string, bucket: string): string | null {
  const match = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?#]+)/.exec(url.trim())
  if (!match || match[1] !== bucket) return null
  let path: string
  try {
    path = decodeURIComponent(match[2]!)
  } catch {
    return null
  }
  return /^banners\/[\w-]+\.jpg$/.test(path) ? path : null
}

/** A JPEG's first bytes: FF D8 FF. */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}
