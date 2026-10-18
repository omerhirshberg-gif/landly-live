import type { Metadata } from 'next'

// /categories/bestsellers is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Bestsellers' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
