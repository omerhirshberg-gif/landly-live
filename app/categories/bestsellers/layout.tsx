import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/site'

// /categories/bestsellers is a client component, so its tab title and search metadata live here.
export const metadata: Metadata = pageMetadata({
  title: 'Bestsellers',
  description: "Landly's most popular perks: the discounts in Israel that olim, lone soldiers, students and travelers use most.",
  path: '/categories/bestsellers',
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
