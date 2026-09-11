'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminGate, { ADMIN_SESSION_KEY } from '@/components/admin/AdminGate'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const logout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY)
    router.push('/admin/login')
  }

  // The login page has no session to log out of yet -- it keeps its own
  // standalone centered layout (still dark-themed) instead of the header below.
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
      <div className="min-h-screen bg-slate-950" dir="ltr">
        <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
          <Link href="/admin" className="flex items-center gap-3">
            <img src="/logo-mark.png" alt="Landly" className="h-8 w-auto" />
            <div className="flex items-center gap-2">
              <span className="font-black text-white text-lg leading-none">Landly</span>
              <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wide text-brand bg-brand/10 border border-brand/30 rounded-full px-2 py-0.5">
                Admin
              </span>
            </div>
          </Link>
          <button
            onClick={logout}
            className="btn-secondary !min-h-0 !py-2 !px-4 text-sm inline-flex items-center gap-2"
          >
            <i className="fa-solid fa-right-from-bracket text-xs" aria-hidden="true" />
            Logout
          </button>
        </header>
        <main className="px-6 py-8">{children}</main>
      </div>
    </AdminGate>
  )
}
