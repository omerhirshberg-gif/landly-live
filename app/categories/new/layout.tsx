import type { Metadata } from 'next'

// /categories/new is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'New Perks' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
