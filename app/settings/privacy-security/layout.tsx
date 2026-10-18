import type { Metadata } from 'next'

// /settings/privacy-security is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Privacy & Security' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
