import type { Metadata } from 'next'
import BusinessDashboardShell from '@/components/business/BusinessDashboardShell'

// The shell is a client component (auth, language, sign-out), so the tab
// title lives in this server layout around it.
// A layout with a plain title would clear the template for the pages below
// it, so it re-declares the namespace's template.
export const metadata: Metadata = { title: { default: 'Business Dashboard', template: '%s | Landly Business' } }

export default function BusinessDashboardLayout({ children }: { children: React.ReactNode }) {
  return <BusinessDashboardShell>{children}</BusinessDashboardShell>
}
