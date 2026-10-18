import type { Metadata } from 'next'

// /wishlist is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Wishlist' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
