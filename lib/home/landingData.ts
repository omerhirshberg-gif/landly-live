import type { OfferDocument } from '@/lib/firebase/offers'
import { isOfferClaimable, type PublicOffer } from '@/lib/offers/publicOffer'
import { compareFeatured } from '@/lib/perks/perksFilter'

// The guest landing's live content, cut from the offers app/page.tsx reads on
// the server. Every deal here is a live, claimable offer, and a section with
// nothing real to show is left out. Never a placeholder merchant. Pure, so
// it's tested without Firestore.

export interface LandingData {
  deals: OfferDocument[]
}

export const EMPTY_LANDING: LandingData = { deals: [] }

export const DEALS_MAX = 12

// The card's shape; the fields a card never reads take their empty defaults.
function toDeal(offer: PublicOffer): OfferDocument {
  return {
    id: offer.id,
    businessId: offer.businessId ?? '',
    businessName: offer.businessName,
    businessTranslations: offer.businessTranslations ?? null,
    location: offer.location ?? '',
    imageUrl: offer.imageUrl,
    businessLogoUrl: offer.businessLogoUrl ?? '',
    title: offer.title,
    description: offer.description,
    originalPrice: offer.originalPrice,
    offerPrice: offer.offerPrice,
    category: offer.category,
    createdAt: offer.createdAt,
    isBestseller: !!offer.isBestseller,
    expiryDate: offer.expiryDate,
    totalQuantity: offer.totalQuantity ?? null,
    claimedCount: offer.claimedCount ?? 0,
    validityDays: 0,
    redemptionTerms: '',
    redemptionMethod: offer.redemptionMethod ?? 'in_store',
    redemptionInstructions: '',
    translations: offer.translations ?? null,
    city: offer.city,
    address: offer.address ?? null,
  }
}

/** The live offers as the guest landing's sections. */
export function toLandingData(offers: readonly PublicOffer[]): LandingData {
  const active = offers.filter((offer) => isOfferClaimable(offer) && offer.businessName.trim())
  return { deals: active.map(toDeal).sort(compareFeatured).slice(0, DEALS_MAX) }
}
