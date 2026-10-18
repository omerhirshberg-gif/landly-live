import type { Metadata } from 'next'

// /settings/member-type is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Customer Type' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
