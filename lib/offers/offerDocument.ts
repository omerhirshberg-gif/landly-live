import { normalizeRedemptionTerms, normalizeValidityDays } from '../payments/voucherTerms'
import { normalizeImageUrl } from '../offers/imageUrl'
import { normalizeRedemptionInstructions, normalizeRedemptionMethod, type RedemptionMethod } from '../offers/redemption'
import { parseOfferTranslations, type OfferTranslations } from '../offers/offerText'
import { parseCoordinates, parseLocalizedName, parsePlaceSnapshot, type Coordinates, type LocalizedName, type ParticipatingPlace, type PlaceSnapshot } from '../geo'
import { parseFulfillmentType, type FulfillmentType } from '../inventory/types'
import { readPerkScope, type PerkScope } from '../offers/perkScope'
import { parseBusinessTranslations, type BusinessTranslations } from '../business/businessText'

// The offer as the apps read it. Pure (no Firebase imports), so the cached
// /api/public/offers route (Admin SDK) and the client SDK map documents the
// same way: a timestamp is anything with toDate(), from either SDK.
function toDate(value: unknown): Date | null {
  return value && typeof (value as { toDate?: unknown }).toDate === 'function' ? (value as { toDate: () => Date }).toDate() : null
}

export interface OfferDocument {
  id: string
  businessId: string
  businessName: string // denormalized
  // The name in the other languages (lib/business/businessText.ts), copied from the business; null before its first translation.
  businessTranslations?: BusinessTranslations | null
  location: string // denormalized from businesses/{businessId}.location
  imageUrl: string // externally-hosted image link, admin-pasted; empty = no image
  // The business's logo (lib/business/businessLogo.ts), copied from businesses/{businessId}.logoUrl; '' = none.
  // Optional only for hand-built fixtures: every offer read from Firestore has it.
  businessLogoUrl?: string
  title: string
  description: string
  originalPrice: number
  offerPrice: number
  category: string
  createdAt: Date | null // server-set at creation, immutable; null only for offers that predate this field
  isBestseller: boolean // manual admin toggle
  expiryDate: Date | null
  totalQuantity: number | null // null = unlimited claims
  claimedCount: number
  validityDays: number // how long a voucher bought now stays valid; DEFAULT_VOUCHER_VALIDITY_DAYS when unset
  redemptionTerms: string // the merchant's conditions for using the voucher; '' = none stated
  redemptionMethod: RedemptionMethod // in store, online or by phone; 'in_store' for offers from before methods existed
  redemptionInstructions: string // the merchant's own steps, one per line; '' = the method's default steps
  // The text fields in the other languages (lib/i18n/contentTranslation.ts); null before the first translation.
  translations?: OfferTranslations | null
  geo?: Coordinates | null // denormalized from businesses/{businessId}.address; null = not geocoded
  city?: LocalizedName // denormalized like geo; {} when unknown
  address?: PlaceSnapshot | null // denormalized like geo: the address lines in each language; null = not geocoded
  // How it's fulfilled and who honours it (lib/offers/perkScope.ts). A Multipass perk has a brand instead of a business;
  // a multi-chain one lists its chains. Optional only for hand-built fixtures: every offer read from Firestore has them.
  fulfillmentType?: FulfillmentType
  perkScope?: PerkScope
  isNationwide?: boolean // a direct-merchant chain redeemable across its branches: no single address or navigation (lib/offers/locationVisibility.ts)
  brandName?: string
  participatingChains?: string[]
  participatingPlaces?: ParticipatingPlace[] // branches picked from Google Places: names in each language and exact positions (lib/geo.ts)
  chainsCount?: number
  universalRedemptionGuide?: { he: string; en: string } | null
}

export function toOfferDocument(id: string, data: Record<string, unknown>): OfferDocument {
  return {
    id,
    businessId: (data.businessId as string) ?? '',
    businessName: (data.businessName as string) ?? '',
    businessTranslations: parseBusinessTranslations(data.businessTranslations),
    location: (data.location as string) ?? '',
    // Normalized on read too, so links saved before the admin routes did it still render.
    imageUrl: normalizeImageUrl(typeof data.imageUrl === 'string' ? data.imageUrl : ''),
    businessLogoUrl: normalizeImageUrl(typeof data.businessLogoUrl === 'string' ? data.businessLogoUrl : ''),
    title: (data.title as string) ?? '',
    description: (data.description as string) ?? '',
    originalPrice: Number(data.originalPrice) || 0,
    offerPrice: Number(data.offerPrice) || 0,
    category: (data.category as string) ?? '',
    createdAt: toDate(data.createdAt),
    isBestseller: !!data.isBestseller,
    expiryDate: toDate(data.expiryDate),
    totalQuantity: typeof data.totalQuantity === 'number' ? data.totalQuantity : null,
    claimedCount: Number(data.claimedCount) || 0,
    validityDays: normalizeValidityDays(data.validityDays),
    redemptionTerms: normalizeRedemptionTerms(data.redemptionTerms),
    redemptionMethod: normalizeRedemptionMethod(data.redemptionMethod),
    redemptionInstructions: normalizeRedemptionInstructions(data.redemptionInstructions),
    translations: parseOfferTranslations(data.translations),
    geo: parseCoordinates(data.geo),
    city: parseLocalizedName(data.city),
    address: parsePlaceSnapshot(data.address),
    fulfillmentType: parseFulfillmentType(data.fulfillmentType),
    ...readPerkScope(data),
  }
}


/** An offer on the wire (JSON): the two dates as ISO strings. */
export type OfferWire = Omit<OfferDocument, 'createdAt' | 'expiryDate'> & { createdAt: string | null; expiryDate: string | null }

export function offerToWire(offer: OfferDocument): OfferWire {
  return { ...offer, createdAt: offer.createdAt?.toISOString() ?? null, expiryDate: offer.expiryDate?.toISOString() ?? null }
}

/** Back from the wire; null for anything that isn't an offer, so a bad payload never reaches a screen. */
export function offerFromWire(value: unknown): OfferDocument | null {
  if (!value || typeof value !== 'object') return null
  const wire = value as OfferWire
  if (typeof wire.id !== 'string' || !wire.id) return null
  const date = (iso: unknown) => {
    const d = typeof iso === 'string' ? new Date(iso) : null
    return d && !Number.isNaN(d.getTime()) ? d : null
  }
  return { ...wire, createdAt: date(wire.createdAt), expiryDate: date(wire.expiryDate) }
}
