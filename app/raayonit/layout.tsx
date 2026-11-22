import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/site'

export const metadata: Metadata = pageMetadata({
  title: 'Raayonit Card',
  description: 'The Raayonit Card and every business that accepts it: restaurants, hotels, spas, attractions and more across Israel.',
  path: '/raayonit',
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
