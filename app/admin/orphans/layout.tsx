import type { Metadata } from 'next'

// /admin/orphans is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Orphaned Accounts' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
