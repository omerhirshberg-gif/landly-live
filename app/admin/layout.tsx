import type { Metadata, Viewport } from 'next'
import AdminShell from '@/components/admin/AdminShell'

// Admin pages read "<page> | Landly Admin". The default is absolute: a plain
// default would get the root "%s | Landly" template appended to it.
export const metadata: Metadata = {
  title: { absolute: 'Admin Portal | Landly', template: '%s | Landly Admin' },
}

// viewport-fit=cover makes env(safe-area-inset-*) report the notch and home
// indicator, which the admin header, drawer and sticky form actions pad for.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F8FAFC',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
