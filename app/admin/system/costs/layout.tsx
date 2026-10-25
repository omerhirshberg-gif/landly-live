import type { Metadata } from 'next'

// /admin/system/costs is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Usage & Costs' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
