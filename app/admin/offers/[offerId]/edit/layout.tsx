import type { Metadata } from 'next'

// /admin/offers/[offerId]/edit is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Edit Offer' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
