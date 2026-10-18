import type { Metadata } from 'next'

// /reset-password/success is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Password Updated' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
