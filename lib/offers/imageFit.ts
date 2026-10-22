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
