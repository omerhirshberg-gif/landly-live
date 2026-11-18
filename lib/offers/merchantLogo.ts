import { perkImageFit } from '@/lib/offers/imageFit'

// Which logo stands for the business on the purchase surfaces (the offer's page, the order summary,
// the voucher, the order confirmation), on the website and in the Expo app. Pure, so both share it.
//
// In strict priority order:
//   1. the business's own logo (`businessLogoUrl`), when set;
//   2. one of our bundled Raayonit brand images (…/images/raayonit-brands/{file}) named by the offer's image;
//   3. the offer's own image, when it is a logo (its link names one or it is a vector);
//   4. a Raayonit-issued offer with no brand logo of its own: the Raayonit logo tile.
// Anything else is `null`: nothing is drawn. Never a blank white square, a category glyph or a monogram letter.

export type MerchantLogo =
  | { kind: 'url'; url: string }
  | { kind: 'raayonit' }

export interface MerchantLogoSource {
  businessLogoUrl?: string | null
  imageUrl?: string | null
  fulfillmentType?: string | null
  redemptionKind?: string | null
  issuer?: { id?: string } | null
}

const BUNDLED_BRAND = /(?:^|\/)images\/raayonit-brands\/[\w-]+\.(?:png|jpe?g|webp)(?:[?#]|$)/i

/** A link a person's device can load: a web link, or one of our own paths; blank and junk are not. */
const usable = (raw: string | null | undefined) => (raw ?? '').trim()

/** Whether the offer is issued by Raayonit (a pooled code voucher), so its logo may stand in for a missing brand logo. */
export function isRaayonitIssued(source: MerchantLogoSource): boolean {
  return source.fulfillmentType === 'raayonit_pool' || source.redemptionKind === 'code_only' || source.issuer?.id === 'raayonit'
}

export function resolveMerchantLogo(source: MerchantLogoSource): MerchantLogo | null {
  const own = usable(source.businessLogoUrl)
  if (own) return { kind: 'url', url: own }
  const image = usable(source.imageUrl)
  if (image && BUNDLED_BRAND.test(image)) return { kind: 'url', url: image }
  if (image && perkImageFit(image, null) === 'contain') return { kind: 'url', url: image }
  return isRaayonitIssued(source) ? { kind: 'raayonit' } : null
}

export interface PurchaseMediaSource {
  /** The order's snapshot (lib/firebase/orders.ts): present from the moment of purchase, so nothing waits for the offer. */
  order?: { businessLogoUrl?: string | null; offerImageUrl?: string | null; fulfillmentType?: string | null } | null
  /** The live offer, when it has loaded: fills what an older order never froze. */
  offer?: MerchantLogoSource | null
}

/**
 * The picture for an offer summary on the purchase screens (the order summary, the confirmation): the business's logo by the chain
 * above (the Raayonit tile only when the offer has no photo), else the offer's own photo, else nothing. The photo shows only when there is no logo, so one business is never drawn twice.
 */
export function purchaseMedia({ order, offer }: PurchaseMediaSource): { logo: MerchantLogo | null; photoUrl: string } {
  const imageUrl = usable(order?.offerImageUrl) || usable(offer?.imageUrl)
  const logo = resolveMerchantLogo({
    businessLogoUrl: usable(order?.businessLogoUrl) || usable(offer?.businessLogoUrl),
    imageUrl,
    fulfillmentType: order?.fulfillmentType ?? offer?.fulfillmentType,
    redemptionKind: offer?.redemptionKind,
    issuer: offer?.issuer,
  })
  // The Raayonit tile only stands in for a picture the offer lacks: an offer with its own photo (the multi-chain one) shows that.
  if (logo?.kind === 'raayonit' && imageUrl) return { logo: null, photoUrl: imageUrl }
  return { logo, photoUrl: logo ? '' : imageUrl }
}
