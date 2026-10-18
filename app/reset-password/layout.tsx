import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'

// A layout with a plain title would clear the template for the pages below
// it, so it re-declares the namespace's template.
export const metadata: Metadata = { title: { default: 'Reset Password', template: '%s | Landly' } }

// /reset-password and /reset-password/success are client components, so their
// viewport lives here. Same as
// app/login/page.tsx: viewport-fit=cover lets the screen run edge to edge on
// notched phones, padded by the safe-area insets in entrance.module.css.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f8fafc',
}

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
