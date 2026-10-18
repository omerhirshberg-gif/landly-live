import type { Metadata } from 'next'
import { PERKS_DESCRIPTION, PERKS_TITLE, pageMetadata } from '@/lib/seo/site'

// /categories is a client component, so its tab title and search metadata
// live here. A layout with a plain title would clear the template for the
// pages below it, so it re-declares the namespace's template. Filtered views
// (?cat=, ?q=) share the catalog's canonical URL.
export const metadata: Metadata = {
  ...pageMetadata({ title: PERKS_TITLE, description: PERKS_DESCRIPTION, path: '/categories' }),
  title: { default: PERKS_TITLE, template: '%s | Landly' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
