import { purchaseMedia, resolveMerchantLogo, type MerchantLogoSource, type PurchaseMediaSource } from '@shared/offers/merchantLogo'
import { secureImageUrl, siteImageFile } from './imageSource'

/** A photo link as the device draws it: a web link, or one of the site's bundled pictures (a relative path no device can fetch) as it is. */
const photoLink = (raw: string) => (siteImageFile(raw) ? raw.trim() : secureImageUrl(raw))

// The business's logo on a purchase surface, as the device loads it (web: lib/offers/merchantLogo.ts
// holds the rules). `logoUri` is a secured link or one of our bundled brand paths (MerchantBadge
// resolves those to the bundled file); `raayonit` asks MerchantBadge for the Raayonit logo tile instead.
export interface ResolvedMerchantLogo {
  logoUri: string | null
  raayonit: boolean
}

export function resolveNativeMerchantLogo(source: MerchantLogoSource): ResolvedMerchantLogo | null {
  const logo = resolveMerchantLogo(source)
  if (!logo) return null
  if (logo.kind === 'raayonit') return { logoUri: null, raayonit: true }
  const uri = secureImageUrl(logo.url)
  // A bundled brand path is not a web link, so it passes as it is.
  const bundled = /(?:^|\/)images\/raayonit-brands\//i.test(logo.url)
  const resolved = bundled ? logo.url : uri
  return resolved ? { logoUri: resolved, raayonit: false } : null
}

/** An order summary's picture on a purchase screen: the logo (as MerchantBadge takes it), else the offer's photo link, else nothing. */
export function resolveNativePurchaseMedia(source: PurchaseMediaSource): { logo: ResolvedMerchantLogo | null; photoUri: string } {
  const { logo, photoUrl } = purchaseMedia(source)
  if (!logo) return { logo: null, photoUri: photoLink(photoUrl) }
  if (logo.kind === 'raayonit') return { logo: { logoUri: null, raayonit: true }, photoUri: '' }
  const bundled = /(?:^|\/)images\/raayonit-brands\//i.test(logo.url)
  const uri = bundled ? logo.url : secureImageUrl(logo.url)
  return uri ? { logo: { logoUri: uri, raayonit: false }, photoUri: '' } : { logo: null, photoUri: photoLink(photoUrl) }
}
