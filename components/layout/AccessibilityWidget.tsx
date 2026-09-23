'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'

// Route exclusions do not unload code already run on an earlier page during
// client-side navigation. This residual risk is explicitly accepted; no reloads.
export function excludesAccessibilityWidget(pathname: string): boolean {
  return ['/admin', '/business/dashboard', '/business/login', '/login', '/signup',
    '/forgot-password', '/reset-password', '/verify-email'].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

export default function AccessibilityWidget() {
  const pathname = usePathname()
  if (!pathname || excludesAccessibilityWidget(pathname)) return null

  return <Script src="https://cdn.enable.co.il/licenses/enable-L563244uhpzx2wnq-0926-83757/init.js" strategy="afterInteractive" />
}
