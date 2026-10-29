// Offer banners uploaded from the admin live at banners/{uuid}.jpg, and
// business logos at logos/{uuid}.png (lossless, transparent) or, for an
// older upload or a photo-like logo, logos/{uuid}.jpg, in the project's Storage bucket
// (storage.rules: public read, no client writes).
// Pure helpers shared by the upload route, the offer routes' cleanup and the
// unit tests.

export const BANNER_PREFIX = 'banners/'
export const LOGO_PREFIX = 'logos/'
/** Server-side cap, the same as the browser's (lib/images/crop.ts): under Vercel's 4.5MB request limit. */
export { MAX_UPLOAD_BYTES } from '../images/crop'

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
  return uploadedPathFromUrl(url, bucket, /^banners\/[\w-]+\.jpg$/)
}

/**
 * The logos/… object behind one of our own download URLs, or null for
 * anything else. Kept apart from banners: an offer's cleanup never deletes
 * its business's logo, which every offer of the business shares.
 */
export function logoPathFromUrl(url: string, bucket: string): string | null {
  return uploadedPathFromUrl(url, bucket, /^logos\/[\w-]+\.(jpg|png)$/)
}

function uploadedPathFromUrl(url: string, bucket: string, shape: RegExp): string | null {
  const match = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?#]+)/.exec(url.trim())
  if (!match || match[1] !== bucket) return null
  let path: string
  try {
    path = decodeURIComponent(match[2]!)
  } catch {
    return null
  }
  return shape.test(path) ? path : null
}

/** A JPEG's first bytes: FF D8 FF. */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** A PNG's eight-byte signature: 89 'PNG' CR LF 1A LF. */
export function isPng(bytes: Uint8Array): boolean {
  return bytes.length > PNG_SIGNATURE.length && PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)
}

/** The stored type of an upload's bytes, or null for anything we don't keep. */
export function uploadImageType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (isJpeg(bytes)) return 'image/jpeg'
  if (isPng(bytes)) return 'image/png'
  return null
}
