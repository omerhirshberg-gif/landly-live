import type { Metadata } from 'next'

// /admin/users is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Users' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
