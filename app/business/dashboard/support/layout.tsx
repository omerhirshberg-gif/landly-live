import type { Metadata } from 'next'

// /business/dashboard/support is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Support' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
