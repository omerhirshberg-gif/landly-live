import type { MetadataRoute } from 'next'
import { getLivePublicOffers } from '@/lib/firebase/publicOffers'
import { siteUrl } from '@/lib/seo/site'

type ChangeFrequency = MetadataRoute.Sitemap[number]['changeFrequency']

// Public, indexable pages, then every live perk (/offers/{id}), read from
// Firestore. Category views are ?cat= filters on /categories, which shares
// its canonical URL, so they aren't listed; everything private is blocked in
// robots.ts. Rebuilt at most hourly, so new perks appear without a deploy;
// without Firestore (a local build) it's the static pages alone.
export const revalidate = 3600

const ROUTES: { path: string; changeFrequency: ChangeFrequency; priority: number }[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/categories', changeFrequency: 'daily', priority: 0.9 },
  { path: '/olim', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/categories/new', changeFrequency: 'daily', priority: 0.8 },
  { path: '/categories/bestsellers', changeFrequency: 'daily', priority: 0.8 },
  { path: '/business', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/support', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const pages: MetadataRoute.Sitemap = ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: siteUrl(path),
    lastModified: now,
    changeFrequency,
    priority,
  }))
  const offers: MetadataRoute.Sitemap = (await getLivePublicOffers()).map((offer) => ({
    url: siteUrl(`/offers/${encodeURIComponent(offer.id)}`),
    lastModified: offer.createdAt ?? now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))
  return [...pages, ...offers]
}
