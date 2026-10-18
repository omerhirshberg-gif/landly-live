import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { PublicOffer } from '@/lib/offers/publicOffer'

const offers = vi.hoisted(() => ({ live: vi.fn(async (): Promise<PublicOffer[]> => []), one: vi.fn(async (_id: string): Promise<PublicOffer | null> => null) }))
vi.mock('@/lib/firebase/publicOffers', () => ({ getLivePublicOffers: offers.live, getPublicOffer: offers.one }))

import {
  offerJsonLd,
  olimServiceJsonLd,
  organizationJsonLd,
  perksAggregateOfferJsonLd,
  serializeJsonLd,
  websiteJsonLd,
} from '@/lib/seo/jsonLd'
import { isOfferLive, offerSeoDescription, toPublicOffer } from '@/lib/offers/publicOffer'
import { pageMetadata } from '@/lib/seo/site'
import sitemap from '@/app/sitemap'
import robots from '@/app/robots'
import { generateMetadata as offerMetadata } from '@/app/offers/[offerId]/layout'

const read = (path: string) => readFileSync(path, 'utf8')

const aroma: PublicOffer = {
  id: 'o1',
  title: '10% at Aroma',
  description: 'Coffee and pastry for 29.',
  businessName: 'Aroma',
  category: 'Restaurants and Cafes',
  imageUrl: 'https://cdn.example/aroma.jpg',
  offerPrice: 29,
  originalPrice: 45,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  expiryDate: new Date('2026-12-31T00:00:00Z'),
}
const gym: PublicOffer = { ...aroma, id: 'o 2', title: 'Gym month', businessName: '', offerPrice: 99, expiryDate: null, description: '', imageUrl: '' }

beforeEach(() => {
  offers.live.mockReset().mockResolvedValue([])
  offers.one.mockReset().mockResolvedValue(null)
})

describe('JSON-LD', () => {
  it('escapes markup so no value can close the script', () => {
    const json = serializeJsonLd({ name: '</script><script>alert(1)</script> & co' })
    expect(json).not.toContain('<')
    expect(json).not.toContain('>')
    expect(JSON.parse(json).name).toBe('</script><script>alert(1)</script> & co')
  })

  it('describes Landly and its perk search', () => {
    expect(organizationJsonLd()).toMatchObject({ '@type': 'Organization', name: 'Landly', url: 'https://www.golandly.com', logo: 'https://www.golandly.com/logo-mark.png' })
    const site = websiteJsonLd()
    expect(site.potentialAction).toMatchObject({ '@type': 'SearchAction', target: { urlTemplate: 'https://www.golandly.com/categories?q={search_term_string}' } })
    expect(site.publisher).toEqual({ '@id': organizationJsonLd()['@id'] })
  })

  it('sums the live perks into one AggregateOffer, or nothing without perks', () => {
    expect(perksAggregateOfferJsonLd([])).toBeNull()
    const agg = perksAggregateOfferJsonLd([aroma, gym])!
    expect(agg).toMatchObject({ '@type': 'AggregateOffer', priceCurrency: 'ILS', lowPrice: 29, highPrice: 99, offerCount: 2 })
    const list = agg.offers as Record<string, unknown>[]
    expect(list[1].url).toBe('https://www.golandly.com/offers/o%202')
    expect(list[0]).toMatchObject({ price: 29, priceCurrency: 'ILS', priceValidUntil: '2026-12-31', offeredBy: { '@type': 'LocalBusiness', name: 'Aroma' } })
    // Empty values drop out of the JSON rather than appearing as blanks.
    expect(JSON.parse(serializeJsonLd(list[1]))).not.toHaveProperty('offeredBy')
  })

  it('makes a perk page a Product with its member price', () => {
    expect(offerJsonLd(aroma)).toMatchObject({
      '@type': 'Product',
      name: '10% at Aroma',
      brand: { '@type': 'Brand', name: 'Aroma' },
      image: 'https://cdn.example/aroma.jpg',
      offers: { '@type': 'Offer', price: 29, priceCurrency: 'ILS', url: 'https://www.golandly.com/offers/o1' },
    })
  })

  it('presents /olim as a free service for olim and lone soldiers', () => {
    const service = olimServiceJsonLd()
    expect(service).toMatchObject({ '@type': 'Service', offers: { price: 0 } })
    expect(JSON.stringify(service.audience)).toContain('Lone soldiers')
  })
})

describe('public offers', () => {
  it('maps an offer, trimmed, and skips one with no title', () => {
    expect(toPublicOffer('x', { title: '  ', offerPrice: 5 })).toBeNull()
    expect(toPublicOffer('x', undefined)).toBeNull()
    const ts = { toDate: () => new Date('2027-01-01T00:00:00Z') }
    expect(toPublicOffer('x', { title: ' Pizza ', offerPrice: '20', expiryDate: ts })).toMatchObject({ title: 'Pizza', offerPrice: 20, expiryDate: new Date('2027-01-01T00:00:00Z') })
  })

  it('counts an offer with no expiry, or a future one, as live', () => {
    const now = new Date('2026-10-18T00:00:00Z').getTime()
    expect(isOfferLive(gym, now)).toBe(true)
    expect(isOfferLive(aroma, now)).toBe(true)
    expect(isOfferLive({ ...aroma, expiryDate: new Date('2026-01-01T00:00:00Z') }, now)).toBe(false)
  })

  it('writes a search description of at most 160 characters', () => {
    expect(offerSeoDescription(aroma)).toBe('Coffee and pastry for 29.')
    expect(offerSeoDescription(gym)).toContain('Gym month')
    const long = offerSeoDescription({ ...aroma, description: 'word '.repeat(80) })
    expect(long.length).toBeLessThanOrEqual(160)
    expect(long.endsWith('…')).toBe(true)
  })
})

describe('page metadata', () => {
  it('gives each public page its own canonical URL and share text', () => {
    expect(pageMetadata({ title: 'X', description: 'Y', path: '/olim' })).toMatchObject({
      title: 'X',
      description: 'Y',
      alternates: { canonical: '/olim' },
      openGraph: { url: '/olim', title: 'X', locale: 'en_US' },
      twitter: { card: 'summary_large_image' },
    })
    expect(pageMetadata({ title: 'Home', description: 'Y', path: '/', absoluteTitle: true }).title).toEqual({ absolute: 'Home' })
  })

  it('never sets a canonical on the root layout, which every page inherits', () => {
    const layout = read('app/layout.tsx')
    expect(layout).not.toContain('alternates')
    expect(layout).toContain('<JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />')
  })

  it('targets Aliyah, olim and lone soldier searches on the key pages', () => {
    const site = read('lib/seo/site.ts')
    for (const phrase of ['Aliyah Benefits', 'Lone Soldiers', 'olim chadashim', 'personal Aliyah mentor', 'lifestyle discounts across Israel']) expect(site).toContain(phrase)
    expect(read('app/page.tsx')).toContain("path: '/', absoluteTitle: true")
    expect(read('app/olim/layout.tsx')).toContain("path: '/olim'")
    expect(read('app/categories/layout.tsx')).toContain("path: '/categories'")
  })

  it("titles a perk page after the perk, with its description, canonical and photo", async () => {
    offers.one.mockResolvedValue(aroma)
    const meta = await offerMetadata({ params: Promise.resolve({ offerId: 'o1' }) })
    expect(meta).toMatchObject({
      title: '10% at Aroma',
      description: 'Coffee and pastry for 29.',
      alternates: { canonical: '/offers/o1' },
      openGraph: { images: [{ url: 'https://cdn.example/aroma.jpg' }] },
    })
    offers.one.mockResolvedValue(null)
    expect(await offerMetadata({ params: Promise.resolve({ offerId: 'gone' }) })).toEqual({ title: 'Perk' })
  })
})

describe('sitemap and robots', () => {
  it('lists the public pages, then every live perk', async () => {
    offers.live.mockResolvedValue([aroma, gym])
    const urls = (await sitemap()).map((e) => e.url)
    expect(urls.slice(0, 3)).toEqual(['https://www.golandly.com', 'https://www.golandly.com/categories', 'https://www.golandly.com/olim'])
    expect(urls).toContain('https://www.golandly.com/offers/o1')
    expect(urls).toContain('https://www.golandly.com/offers/o%202')
    expect(urls.some((u) => /\/categories\/(?!new$|bestsellers$)/.test(u))).toBe(false)
  })

  it('falls back to the static pages without Firestore', async () => {
    const entries = await sitemap()
    expect(entries).toHaveLength(10)
    expect(entries.map((e) => e.url)).toContain('https://www.golandly.com/about')
    expect(entries.every((e) => !e.url.includes('/offers/'))).toBe(true)
  })

  it('keeps crawlers out of private, member and internal routes', () => {
    const rules = robots().rules as { disallow: string[] }
    for (const path of ['/admin', '/api', '/member', '/profile', '/settings', '/checkout', '/order-success', '/login', '/signup']) expect(rules.disallow).toContain(path)
    expect(robots().sitemap).toBe('https://www.golandly.com/sitemap.xml')
  })
})
