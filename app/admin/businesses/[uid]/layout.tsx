import type { Metadata } from 'next'

// /admin/businesses/[uid] is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Business Details' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
