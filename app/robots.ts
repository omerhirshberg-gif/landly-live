import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/config'

// Keeps crawlers out of members-only, internal and sign-in pages. Robots
// rules aren't access control: those routes still check auth themselves.
const PRIVATE_PATHS = [
  '/admin',
  '/api',
  '/checkout',
  '/order-success',
  '/settings',
  '/profile',
  '/member',
  '/wishlist',
  '/business/dashboard',
  '/business/login',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
