import type { Metadata } from 'next'

// /olim is a client component, so its tab title lives here.
export const metadata: Metadata = { title: 'Making Aliyah' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
