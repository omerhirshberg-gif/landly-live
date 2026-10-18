import { normalizeImageUrl } from './imageUrl'

// The public face of an offer for search engines and share cards (sitemap,
// JSON-LD, the perk page's metadata): only what the perk page itself shows
// guests. Pure, so it maps both the Admin SDK's documents (server) and test
// fixtures; reading lives in lib/firebase/publicOffers.ts.
export interface PublicOffer {
  id: string
  title: string
  description: string
  businessName: string
  category: string
  imageUrl: string
  offerPrice: number
  originalPrice: number
  createdAt: Date | null
  expiryDate: Date | null
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
    category: str(data.category),
    imageUrl: normalizeImageUrl(str(data.imageUrl)),
    offerPrice: Number(data.offerPrice) || 0,
    originalPrice: Number(data.originalPrice) || 0,
    createdAt: toDate(data.createdAt),
    expiryDate: toDate(data.expiryDate),
  }
}

/** Live: no expiry date, or one that hasn't passed (the same rule as the perk feeds). */
export function isOfferLive(offer: PublicOffer, now = Date.now()): boolean {
  return !offer.expiryDate || offer.expiryDate.getTime() >= now
}

/** A search-result description: the perk's own text on one line, cut at a word near 160 characters. */
export function offerSeoDescription(offer: PublicOffer): string {
  const fallback = `${offer.title}${offer.businessName ? ` at ${offer.businessName}` : ''} — a Landly member perk in Israel for olim, lone soldiers, students and travelers.`
  const text = (offer.description || fallback).replace(/\s+/g, ' ').trim()
  if (text.length <= SEO_DESCRIPTION_MAX) return text
  const cut = text.slice(0, SEO_DESCRIPTION_MAX - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 100 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}
