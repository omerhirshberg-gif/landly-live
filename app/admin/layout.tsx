'use client'

import { usePathname, useRouter } from 'next/navigation'
import AdminGate from '@/components/admin/AdminGate'
import Sidebar from '@/components/admin/Sidebar'
import LiveClock from '@/components/admin/LiveClock'
import SidebarShell from '@/components/layout/SidebarShell'
import { clearStoredToken } from '@/lib/admin/adminSession'
import { getAdminPageTitle } from '@/lib/admin/pageTitle'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const logout = () => {
    clearStoredToken()
    router.push('/admin/login')
  }

  // The login page has no session to log out of yet -- it keeps its own
  // standalone centered layout (still dark-themed) instead of the sidebar below.
  if (pathname === '/admin/login') {
    return (
      <AdminGate>
        <div className="min-h-screen bg-slate-950" dir="ltr">
          {children}
        </div>
      </AdminGate>
    )
  }

  return (
    <AdminGate>
      <div dir="ltr">
        <SidebarShell
          sidebar={<Sidebar onLogout={logout} />}
          header={
            <div className="hidden md:flex items-center justify-between sticky top-0 z-30 px-8 py-4 bg-slate-950/90 backdrop-blur border-b border-white/5">
              <h2 className="text-2xl font-black text-white">{getAdminPageTitle(pathname)}</h2>
              <LiveClock />
            </div>
          }
        >
          {children}
        </SidebarShell>
      </div>
    </AdminGate>
  )
}
