import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/site'

// /about's tab title ("About Us | Landly"), search description, canonical URL and share card.
export const metadata: Metadata = pageMetadata({
  title: 'About Us',
  description: 'Meet Landly and its co-founders, Amit Bar-David and Omer Hirshberg: a free club helping olim, lone soldiers, students and newcomers feel at home in Israel.',
  path: '/about',
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
