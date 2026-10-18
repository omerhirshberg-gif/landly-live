import type { Metadata } from 'next'

// /business/dashboard/history is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Redemption History' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
