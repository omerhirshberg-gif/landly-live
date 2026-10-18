import type { Metadata } from 'next'

// /admin/offers/new is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'New Offer' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
