import type { Metadata } from 'next'

// /admin/businesses/new is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Add New Business' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
