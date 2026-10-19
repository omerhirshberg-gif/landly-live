// Member avatars: where the photo lives in Storage, which URL wins, the
// monogram fallback, and the square crop both pickers apply before upload.
// No dependencies, so the web uploader, the Expo picker and the unit tests
// share it without pulling Firebase in.
import { normalizePersonName, splitDisplayName } from '@/lib/auth/names'

/**
 * The longest edge, in pixels, of the photo that's uploaded: enough for the
 * full-size viewer (up to 360pt) to stay sharp on 3x retina screens.
 */
export const AVATAR_SIZE = 1024
/** JPEG quality of the uploaded photo (a 1024px square lands around 150–350KB). */
export const AVATAR_QUALITY = 0.9
/** Matches storage.rules: anything larger is refused server-side. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

/** One object per member, overwritten by each upload. */
export function avatarPath(uid: string): string {
  return `avatars/${uid}`
}

/**
 * Overwriting avatars/{uid} can keep the same download URL, so a version
 * parameter makes every upload a new URL that browsers and RN's image cache
 * fetch again.
 */
export function withAvatarVersion(url: string, version: number): string {
  return `${url}${url.includes('?') ? '&' : '?'}v=${version}`
}

/** The uploaded photo (users/{uid}.photoURL), else the sign-in provider's (Google), else none. */
export function resolveAvatarUrl(
  doc: { photoURL?: string } | null | undefined,
  authPhotoURL?: string | null
): string | null {
  for (const candidate of [doc?.photoURL, authPhotoURL]) {
    if (typeof candidate === 'string' && /^https?:\/\//.test(candidate)) return candidate
  }
  return null
}

/**
 * Google profile photos come as a small thumbnail (`…=s96-c`), blurry once
 * shown any larger; this asks for `px` pixels instead (at most AVATAR_SIZE,
 * as large as our own uploads). Uploaded photos (Storage) pass through.
 */
export function sizedAvatarUrl(url: string, px: number): string {
  if (!/^https:\/\/[^/]+\.googleusercontent\.com\//.test(url)) return url
  const edge = Math.max(1, Math.min(AVATAR_SIZE, Math.ceil(px)))
  return url.replace(/=s\d+(-c)?$/, `=s${edge}-c`)
}

/** The full-size viewer's source: the original upload, or Google's photo at 1024px. */
export function fullSizeAvatarUrl(url: string): string {
  return sizedAvatarUrl(url, AVATAR_SIZE)
}

/**
 * Up to two letters for the monogram: first and last initials, from the
 * profile's names, else the display name (profile, then Auth). Never from the
 * email — '' means show the person glyph.
 */
export function avatarInitials(
  doc: { firstName?: string; lastName?: string; displayName?: string } | null | undefined,
  authDisplayName?: string | null
): string {
  const sources = [
    { firstName: normalizePersonName(doc?.firstName), lastName: normalizePersonName(doc?.lastName) },
    splitDisplayName(doc?.displayName),
    splitDisplayName(authDisplayName),
  ]
  for (const { firstName, lastName } of sources) {
    if (!firstName || firstName.includes('@')) continue
    // Array.from keeps a surrogate pair (emoji, rare scripts) whole.
    const letters = [firstName, lastName].filter(Boolean).map((part) => Array.from(part)[0] ?? '')
    return letters.join('').toLocaleUpperCase()
  }
  return ''
}

/** The centred square of a width × height image, and the edge it's scaled to. */
export function coverCrop(width: number, height: number): { originX: number; originY: number; side: number; output: number } {
  const side = Math.max(1, Math.floor(Math.min(width, height)))
  return {
    originX: Math.max(0, Math.floor((width - side) / 2)),
    originY: Math.max(0, Math.floor((height - side) / 2)),
    side,
    output: Math.min(AVATAR_SIZE, side),
  }
}
