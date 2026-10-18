import type { Metadata } from 'next'

// /order-success is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Order Confirmed' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
