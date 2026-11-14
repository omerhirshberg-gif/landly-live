import { normalizeImageUrl } from './imageUrl'
import { parseOfferTranslations, type OfferTranslations } from './offerText'
import { parseBusinessTranslations, type BusinessTranslations } from '../business/businessText'
import { normalizeRedemptionMethod, type RedemptionMethod } from './redemption'
import { localizeText } from '../i18n/contentTranslation'
import { parseLocalizedName, parsePlaceSnapshot, type LocalizedName, type PlaceSnapshot } from '../geo'

// The public face of an offer for search engines and share cards (sitemap,
// JSON-LD, the perk page's metadata): only what the perk page itself shows
// guests. Pure, so it maps both the Admin SDK's documents (server) and test
// fixtures; reading lives in lib/firebase/publicOffers.ts.
export interface PublicOffer {
  id: string
  title: string
  description: string
  businessName: string
  businessTranslations?: BusinessTranslations | null
  category: string
  imageUrl: string
  offerPrice: number
  originalPrice: number
  createdAt: Date | null
  expiryDate: Date | null
  translations?: OfferTranslations | null
  // What the guest landing's cards and partner grid show (lib/home/landingData.ts).
  businessId?: string
  businessLogoUrl?: string
  location?: string
  isBestseller?: boolean
  /** null or missing = unlimited claims. */
  totalQuantity?: number | null
  claimedCount?: number
  redemptionMethod?: RedemptionMethod
  city?: LocalizedName
  address?: PlaceSnapshot | null
}

const SEO_DESCRIPTION_MAX = 160

function toDate(value: unknown): Date | null {
  // Admin and client Timestamps both have toDate(); plain Dates pass through.
  if (value instanceof Date) return value
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') return (value as { toDate: () => Date }).toDate()
  return null
}

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/** An offers/{id} document as a PublicOffer, or null when it has no title to show. */
export function toPublicOffer(id: string, data: Record<string, unknown> | undefined): PublicOffer | null {
  if (!data) return null
  const title = str(data.title)
  if (!title) return null
  return {
    id,
    title,
    description: str(data.description),
    businessName: str(data.businessName),
    businessTranslations: parseBusinessTranslations(data.businessTranslations),
    category: str(data.category),
    imageUrl: normalizeImageUrl(str(data.imageUrl)),
    offerPrice: Number(data.offerPrice) || 0,
    originalPrice: Number(data.originalPrice) || 0,
    createdAt: toDate(data.createdAt),
    expiryDate: toDate(data.expiryDate),
    translations: parseOfferTranslations(data.translations),
    businessId: str(data.businessId),
    businessLogoUrl: normalizeImageUrl(str(data.businessLogoUrl)),
    location: str(data.location),
    isBestseller: !!data.isBestseller,
    totalQuantity: typeof data.totalQuantity === 'number' ? data.totalQuantity : null,
    claimedCount: Number(data.claimedCount) || 0,
    redemptionMethod: normalizeRedemptionMethod(data.redemptionMethod),
    city: parseLocalizedName(data.city),
    address: parsePlaceSnapshot(data.address),
  }
}

/** Claimable: unlimited, or not every voucher claimed yet (the same rule as isOfferAvailable). */
export function isOfferClaimable(offer: Pick<PublicOffer, 'totalQuantity' | 'claimedCount'>): boolean {
  return offer.totalQuantity == null || (offer.claimedCount ?? 0) < offer.totalQuantity
}

/** Live: no expiry date, or one that hasn't passed (the same rule as the perk feeds). */
export function isOfferLive(offer: PublicOffer, now = Date.now()): boolean {
  return !offer.expiryDate || offer.expiryDate.getTime() >= now
}

/** A search-result description: the perk's own text on one line, cut at a word near 160 characters. */
export function offerSeoDescription(offer: PublicOffer): string {
  const fallback = `${offer.title}${offer.businessName ? ` at ${offer.businessName}` : ''} — a GoLandly member perk in Israel for olim, lone soldiers, students and travelers.`
  const text = (offer.description || fallback).replace(/\s+/g, ' ').trim()
  if (text.length <= SEO_DESCRIPTION_MAX) return text
  const cut = text.slice(0, SEO_DESCRIPTION_MAX - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 100 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * The offer with its title and description in English when it has an
 * English translation: search results and share cards are rendered on the
 * server, which doesn't know the reader's language, and the site's default
 * language is English. An offer written in English is unchanged.
 */
export function offerInEnglish(offer: PublicOffer): PublicOffer {
  return {
    ...offer,
    title: localizeText(offer.title, offer.translations, 'en', 'title').text,
    description: localizeText(offer.description, offer.translations, 'en', 'description').text,
  }
}
