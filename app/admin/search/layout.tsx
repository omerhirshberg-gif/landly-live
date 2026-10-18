import type { Metadata } from 'next'

// /admin/search is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Search' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
