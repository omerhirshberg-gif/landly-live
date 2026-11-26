import type { Metadata } from 'next'

// A fragment shown inside the app's payment step: never indexed, no title of its own worth reading.
export const metadata: Metadata = { title: 'Secure card fields', robots: { index: false, follow: false } }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
