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
export function dealPhotoFit(size?: { width: number; height: number } | null, opts?: { ambient?: boolean; graphic?: boolean }): PerkImageFit {
  if (!size || size.width <= 0 || size.height <= 0) return 'cover'
  const ratio = size.width / size.height
  // Trimmed brand art (a logo or banner) is never cropped to fill: whole, over the blurred copy, whatever its shape.
  if (opts?.ambient && opts.graphic) return 'contain'
  if (opts?.ambient) return ratio >= AMBIENT_COVER_MIN_RATIO && ratio <= AMBIENT_COVER_MAX_RATIO ? 'cover' : 'contain'
  return ratio >= PHOTO_COVER_MIN_RATIO ? 'cover' : 'contain'
}

/**
 * Raayonit brand art is trimmed to its own shape, so it comes in every ratio. Only a true landscape scene photograph (1.38 to 1.78, 3:2
 * to 16:9) fills the frame; anything squarer, taller or more panoramic, and every trimmed logo or banner (`graphic`), sits whole over a
 * blurred copy of itself, never on white.
 */
export const AMBIENT_COVER_MIN_RATIO = 1.38
export const AMBIENT_COVER_MAX_RATIO = 1.78
