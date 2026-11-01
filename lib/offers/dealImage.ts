import { perkImageFit } from '@/lib/offers/imageFit'

// A perk card's two pictures, on the website and in the Expo app: the offer's
// image and its business's logo (`businessLogoUrl`, set in the admin on the
// business). The offer's image is either a photo of the deal or, pasted by
// admins before logos had their own field, a logo (lib/offers/imageFit.ts
// tells them apart). A photo fills the hero; anything else leaves the hero to
// the category's panel. The badge shows the business's logo, else a logo found
// in the offer's image, else the business's initial. A bitmap whose kind is
// only known once it has loaded is 'pending' until then: the hero shows the
// category panel, and the card fades to the right arrangement.

export type DealImageRole = 'photo' | 'logo' | 'pending' | 'none'

/**
 * What the offer's image is, from its link and (once loaded) its size;
 * 'none' when there is no usable link or it failed to load.
 */
export function dealImageRole(url: string, size: { width: number; height: number } | null, failed: boolean): DealImageRole {
  if (!url || failed) return 'none'
  const fit = perkImageFit(url, size)
  if (fit === 'contain') return 'logo'
  // A cover verdict without a size can still turn out to be a small square logo.
  return size ? 'photo' : 'pending'
}

/**
 * The badge's logo: the business's own, else the offer's image once it's
 * known to be a logo (never both, so a logo never shows twice), else none
 * (the initial).
 */
export function badgeLogoUri(businessLogoUrl: string, heroUrl: string, heroRole: DealImageRole): string | null {
  if (businessLogoUrl) return businessLogoUrl
  return heroRole === 'logo' ? heroUrl : null
}

/** The business's initial for the monogram badge (first grapheme-ish code point, upper-cased). */
export function businessInitial(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? ''
}
