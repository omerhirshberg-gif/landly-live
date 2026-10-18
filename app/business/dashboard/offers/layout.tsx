import type { Metadata } from 'next'

// /business/dashboard/offers is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Offers' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
