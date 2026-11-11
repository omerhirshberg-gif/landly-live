import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import AdminShell from '@/components/admin/AdminShell'
import { ADMIN_LANG_COOKIE, parseAdminLocale } from '@/lib/admin/adminLocale'

// Admin pages read "<page> | Landly Admin". The default is absolute: a plain
// default would get the root "%s | Landly" template appended to it.
export const metadata: Metadata = {
  title: { absolute: 'Admin Portal | Landly', template: '%s | Landly Admin' },
}

// viewport-fit=cover makes env(safe-area-inset-*) report the notch and home
// indicator, which the admin header, drawer and sticky form actions pad for.
// interactive-widget=resizes-content makes Android Chrome shrink the layout
// (and so dvh) for the keyboard, keeping the support reply box above it; iOS
// ignores it, and the inbox follows window.visualViewport there instead
// (lib/admin/useVisualViewport.ts).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#F8FAFC',
}

// The admin's language comes from its own cookie (lib/admin/adminLocale.ts), so the
// first paint already has the right direction.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const initialLocale = parseAdminLocale((await cookies()).get(ADMIN_LANG_COOKIE)?.value)
  return <AdminShell initialLocale={initialLocale}>{children}</AdminShell>
}
