import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'

// The link carries a signed token, so keep it out of search results and out of
// Referer headers.
export const metadata: Metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f8fafc' }

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
