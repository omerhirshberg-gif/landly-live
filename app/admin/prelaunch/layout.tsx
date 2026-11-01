import type { Metadata } from 'next'

// /admin/prelaunch is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Pre-Launch Leads' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
