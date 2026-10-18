import type { Metadata } from 'next'

// /business/login is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Sign In' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
