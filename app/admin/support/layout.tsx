import type { Metadata } from 'next'

// /admin/support is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Support Inbox' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
