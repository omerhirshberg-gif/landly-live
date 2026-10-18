import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/config'

type ChangeFrequency = MetadataRoute.Sitemap[number]['changeFrequency']

// Public, indexable pages only. Offer and category pages that come from
// Firestore aren't listed yet; everything private is blocked in robots.ts.
const ROUTES: { path: string; changeFrequency: ChangeFrequency; priority: number }[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/categories', changeFrequency: 'daily', priority: 0.9 },
  { path: '/categories/new', changeFrequency: 'daily', priority: 0.8 },
  { path: '/categories/bestsellers', changeFrequency: 'daily', priority: 0.8 },
  { path: '/olim', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/business', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/support', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: path === '/' ? SITE_URL : `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
