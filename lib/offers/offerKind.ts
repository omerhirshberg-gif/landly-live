import type { TranslationKey } from '@/lib/i18n/translations'

// The filter's "Offer type", derived from what an offer already stores (no admin field):
// a Raayonit pool is a purchase voucher, anything with a discount a discount, the rest a deal.

export const OFFER_KINDS = ['voucher', 'discount', 'deal'] as const
export type OfferKind = (typeof OFFER_KINDS)[number]

export const OFFER_KIND_LABELS: Record<OfferKind, TranslationKey> = {
  voucher: 'filter_type_voucher',
  discount: 'filter_type_discount',
  deal: 'filter_type_deal',
}

export function offerKind(offer: { fulfillmentType?: string | null; originalPrice?: number | null; offerPrice?: number | null }): OfferKind {
  if (offer.fulfillmentType === 'raayonit_pool') return 'voucher'
  const original = Number(offer.originalPrice) || 0
  const price = Number(offer.offerPrice) || 0
  return original > price && original > 0 ? 'discount' : 'deal'
}
