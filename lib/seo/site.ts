import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/config'

// Search copy for the public pages, in English: the server renders every page
// in English (the language switch is client-side, lib/i18n/LangProvider.tsx),
// so that's the language Google indexes. Written around what olim, lone
// soldiers and visitors search for -- Aliyah benefits, olim perks, lone
// soldier discounts, lifestyle discounts in Israel -- in plain sentences, not
// keyword lists (Google ignores <meta name="keywords">).

export const HOME_TITLE = 'Landly — Aliyah Benefits & Perks for Olim and Lone Soldiers'
export const HOME_DESCRIPTION =
  'Free club for olim chadashim, lone soldiers, students and travelers: real discounts across Israel, Aliyah benefits and a personal Aliyah mentor.'

export const OLIM_TITLE = 'Making Aliyah: Benefits & Lone Soldier Perks'
export const OLIM_DESCRIPTION =
  'Moving to Israel? Landly helps new olim and lone soldiers with Aliyah benefits, perks from day one, a rights checklist and a free personal Aliyah mentor in your language.'

export const PERKS_TITLE = 'Perks & Discounts in Israel'
export const PERKS_DESCRIPTION =
  'Browse lifestyle discounts across Israel: restaurants, cafes, gyms, beauty, attractions and more, for olim, lone soldiers, students and travelers.'

/** An absolute URL on the site for a path such as '/olim'. */
export function siteUrl(path: string): string {
  return path === '/' ? SITE_URL : `${SITE_URL}${path}`
}

/**
 * A public page's title, description, canonical URL and share card text.
 * The canonical is set per page, never on the root layout, where every page
 * would inherit it and claim to be the home page. The share image comes from
 * app/opengraph-image.tsx unless `image` is given.
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  image,
}: {
  title: string
  description: string
  path: string
  /** Use the title as is, without the "| Landly" template (the home page). */
  absoluteTitle?: boolean
  image?: string
}): Metadata {
  const images = image ? [{ url: image }] : undefined
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: 'Landly', locale: 'en_US', url: path, title, description, ...(images && { images }) },
    twitter: { card: 'summary_large_image', title, description, ...(images && { images }) },
  }
}
