import { purchaseMedia, resolveMerchantLogo, type MerchantLogoSource, type PurchaseMediaSource } from '@/lib/offers/merchantLogo'

/** The props MerchantBadge takes for a logo (components/discover/MerchantBadge.tsx), or null when nothing is to be drawn. */
export function merchantBadgeProps(source: MerchantLogoSource | null | undefined): { logoUrl: string; raayonit: boolean } | null {
  const logo = source ? resolveMerchantLogo(source) : null
  if (!logo) return null
  return logo.kind === 'raayonit' ? { logoUrl: '', raayonit: true } : { logoUrl: logo.url, raayonit: false }
}

/** An order summary's picture: the logo's MerchantBadge props, else the offer's photo, else nothing. */
export function purchaseMediaProps(source: PurchaseMediaSource): { badge: { logoUrl: string; raayonit: boolean } | null; photoUrl: string } {
  const { logo, photoUrl } = purchaseMedia(source)
  return {
    badge: !logo ? null : logo.kind === 'raayonit' ? { logoUrl: '', raayonit: true } : { logoUrl: logo.url, raayonit: false },
    photoUrl,
  }
}
