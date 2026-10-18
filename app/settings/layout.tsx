import type { Metadata } from 'next'

// /settings is a client component, so its tab title lives here.
// A layout with a plain title would clear the template for the pages below
// it, so it re-declares the namespace's template.
export const metadata: Metadata = { title: { default: 'Settings', template: '%s | Landly' } }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
