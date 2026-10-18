import type { Metadata } from 'next'

// /business/dashboard/vouchers is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Vouchers' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
