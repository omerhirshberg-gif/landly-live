import type { Metadata } from 'next'

// /member is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'My Pass' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
