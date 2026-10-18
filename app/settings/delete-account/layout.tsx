import type { Metadata } from 'next'

// /settings/delete-account is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Delete Account' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
