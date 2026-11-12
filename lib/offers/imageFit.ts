// How a perk card frames its picture. Admins paste either a lifestyle photo
// (fills the frame: cover) or a business logo (shown whole on the light frame
// with room around it: contain). Nothing in the offer says which, so a URL
// that names a logo or is a vector counts as a logo, and so does a small,
// roughly square bitmap once it has loaded and its size is known.
export type PerkImageFit = 'cover' | 'contain'

const LOGO_URL = /(^|[^a-z])logo|\.svg(\?|#|$)/i
const LOGO_MAX_SIDE = 640

export function perkImageFit(url: string, size?: { width: number; height: number } | null): PerkImageFit {
  if (LOGO_URL.test(url)) return 'contain'
  if (size && size.width > 0 && size.height > 0) {
    const ratio = size.width / size.height
    if (ratio >= 0.8 && ratio <= 1.25 && Math.max(size.width, size.height) <= LOGO_MAX_SIDE) return 'contain'
  }
  return 'cover'
}

/**
 * A photo this much wider than it is tall (or wider) fills the card's hero edge to edge;
 * anything narrower (a square or a portrait shot) is shown whole instead.
 */
export const PHOTO_COVER_MIN_RATIO = 1.2

/**
 * How a perk's photo sits in its hero frame once its size is known: 'cover' for a
 * landscape photo (16:9, 4:3, ...), 'contain' for a square or portrait one, which
 * would lose its head or its feet to a wide crop. Unknown size covers (the frame is
 * showing the category's panel until the bitmap has loaded anyway).
 */
export function dealPhotoFit(size?: { width: number; height: number } | null): PerkImageFit {
  if (!size || size.width <= 0 || size.height <= 0) return 'cover'
  return size.width / size.height >= PHOTO_COVER_MIN_RATIO ? 'cover' : 'contain'
}
