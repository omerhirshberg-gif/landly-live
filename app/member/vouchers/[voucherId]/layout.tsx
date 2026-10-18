import type { Metadata } from 'next'

// The voucher page is a client component, so its tab title lives here. /member's
// plain title clears the root template below it, hence the absolute title.
export const metadata: Metadata = { title: { absolute: 'Voucher | Landly' } }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
