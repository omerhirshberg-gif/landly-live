'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'

// The Enable accessibility widget floats a fixed circular button over the
// whole site. Under /admin it visually collides with the sidebar's logout
// button and isn't relevant for an internal tool, so it's skipped entirely
// there rather than trying to hide its injected DOM with CSS guesswork.
// /business/dashboard has the same fixed sidebar-with-logout shape (same
// collision), so it's skipped there too -- but not /business/login or the
// /business marketing page, which have no sidebar and are still
// customer/business-facing pages where the widget is legitimately useful.
export default function AccessibilityWidget() {
  const pathname = usePathname()
  if (pathname?.startsWith('/admin')) return null
  if (pathname?.startsWith('/business/dashboard')) return null

  return <Script src="https://cdn.enable.co.il/licenses/enable-L563244uhpzx2wnq-0926-83757/init.js" strategy="afterInteractive" />
}
