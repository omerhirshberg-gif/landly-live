import type { Metadata } from 'next'

// /settings/language-region/origin is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Country of Origin' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
