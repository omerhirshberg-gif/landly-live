import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = { title: 'Confirm Your New Email' }

// Same viewport as /verify-email (its sibling landing page).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f8fafc',
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
