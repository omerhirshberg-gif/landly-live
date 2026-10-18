import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/site'

// /categories/new is a client component, so its tab title and search metadata live here.
export const metadata: Metadata = pageMetadata({
  title: 'New Perks',
  description: 'The newest Landly perks: fresh discounts at restaurants, cafes, gyms and more across Israel, for olim, lone soldiers, students and travelers.',
  path: '/categories/new',
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
