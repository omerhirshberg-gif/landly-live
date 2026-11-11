import type { Metadata } from 'next'

// A private, per-merchant link: never indexed, never cached, and the token in
// the path is kept out of the Referer header sent to anything the page loads.
export const metadata: Metadata = {
  title: { absolute: 'Merchant onboarding | Landly Business' },
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
