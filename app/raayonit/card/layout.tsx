import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/site'

export const metadata: Metadata = pageMetadata({
  title: 'Raayonit Card voucher | GoLandly',
  absoluteTitle: true,
  description: 'The Raayonit Card voucher: what it is, how to redeem it, the businesses that accept it, and your choice of ₪100, ₪150 or ₪200 value.',
  path: '/raayonit/card',
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
