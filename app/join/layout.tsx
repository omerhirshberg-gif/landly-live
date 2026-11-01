import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'

// The campaign page stays out of search results and the sitemap: it exists for
// paid and shared links. It's noindex rather than blocked in robots.ts, because
// WhatsApp's and the ad networks' crawlers must still read its share card.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Vercel Web Analytics is the demand test's denominator: signups mean little
// without the visits behind them. Cookieless, so the cookie notice stays true,
// and mounted here alone, so no other page is counted.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Analytics />
    </>
  )
}
