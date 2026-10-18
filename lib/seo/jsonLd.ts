import { FOUNDERS } from '@/lib/about/founders'
import { SITE_URL, SUPPORT_EMAIL } from '@/lib/config'
import type { PublicOffer } from '@/lib/offers/publicOffer'
import { siteUrl } from './site'

// schema.org structured data (JSON-LD) for the public pages, rendered by
// components/seo/JsonLd.tsx. Builders only: pure, so they're tested on their own.

type JsonLdNode = Record<string, unknown>

const ORGANIZATION_ID = `${SITE_URL}/#organization`
const WEBSITE_ID = `${SITE_URL}/#website`

/**
 * JSON for a <script type="application/ld+json">. JSON.stringify doesn't
 * escape markup, so a value holding "</script>" (an admin-typed offer title,
 * say) could end the script early; <, > and & become \u escapes, which JSON
 * parsers read back as the same characters.
 */
export function serializeJsonLd(data: JsonLdNode | JsonLdNode[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

export function organizationJsonLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'Landly',
    url: SITE_URL,
    logo: siteUrl('/logo-mark.png'),
    email: SUPPORT_EMAIL,
    areaServed: { '@type': 'Country', name: 'Israel' },
    founder: FOUNDERS.map((f) => ({ '@type': 'Person', name: f.name })),
    description: 'A free member club for olim chadashim, lone soldiers, students and travelers in Israel: lifestyle discounts, Aliyah benefits and personal Aliyah mentors.',
  }
}

/** The site, with its perk search (/categories?q=) as the search action. */
export function websiteJsonLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: 'Landly',
    url: SITE_URL,
    inLanguage: ['en', 'he', 'fr', 'ru', 'es'],
    publisher: { '@id': ORGANIZATION_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl('/categories')}?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
}

function offerNode(offer: PublicOffer): JsonLdNode {
  return {
    '@type': 'Offer',
    name: offer.title,
    url: siteUrl(`/offers/${encodeURIComponent(offer.id)}`),
    price: offer.offerPrice,
    priceCurrency: 'ILS',
    category: offer.category || undefined,
    availability: 'https://schema.org/InStock',
    ...(offer.expiryDate && { priceValidUntil: offer.expiryDate.toISOString().slice(0, 10) }),
    offeredBy: offer.businessName ? { '@type': 'LocalBusiness', name: offer.businessName } : undefined,
  }
}

/** The club's live perks as one AggregateOffer (price range, count, and each perk), or null with none. */
export function perksAggregateOfferJsonLd(offers: PublicOffer[]): JsonLdNode | null {
  if (offers.length === 0) return null
  const prices = offers.map((o) => o.offerPrice)
  return {
    '@context': 'https://schema.org',
    '@type': 'AggregateOffer',
    name: 'Landly member perks in Israel',
    url: siteUrl('/categories'),
    priceCurrency: 'ILS',
    lowPrice: Math.min(...prices),
    highPrice: Math.max(...prices),
    offerCount: offers.length,
    seller: { '@id': ORGANIZATION_ID },
    offers: offers.map(offerNode),
  }
}

/** One perk's page: the perk as a Product (the business as its brand) with its member price as the Offer. */
export function offerJsonLd(offer: PublicOffer): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: offer.title,
    description: offer.description || undefined,
    image: offer.imageUrl || undefined,
    brand: offer.businessName ? { '@type': 'Brand', name: offer.businessName } : undefined,
    category: offer.category || undefined,
    offers: offerNode(offer),
  }
}

/** /olim: the Aliyah and lone soldier help, as a free Service from Landly. */
export function olimServiceJsonLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Aliyah benefits and personal Aliyah mentor',
    serviceType: 'Aliyah and lone soldier support',
    url: siteUrl('/olim'),
    provider: { '@id': ORGANIZATION_ID },
    areaServed: { '@type': 'Country', name: 'Israel' },
    audience: [
      { '@type': 'Audience', audienceType: 'New immigrants to Israel (olim chadashim)' },
      { '@type': 'Audience', audienceType: 'Lone soldiers in the IDF' },
    ],
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'ILS', description: 'Free for Landly club members' },
  }
}
