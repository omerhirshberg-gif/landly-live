'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import AdminGate from './AdminGate'
import AdminHeader from './AdminHeader'
import Sidebar from './Sidebar'
import { clearStoredToken } from '@/lib/admin/adminSession'

// The admin UI is English, so the portal is LTR even inside the Hebrew site.
// Layout classes are logical (ps/pe, start/end) and user data carries
// dir="auto", so Hebrew names render correctly inside it.
const CANVAS = 'min-h-dvh bg-gradient-to-b from-[#F8FAFC] to-[#F1F5F9] text-[#475569] antialiased'

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  // Escape, the backdrop or the close button: focus goes back to the menu button.
  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    menuButtonRef.current?.focus()
  }, [])
  // A nav link: focus follows the navigation instead.
  const dismissMenu = useCallback(() => setMenuOpen(false), [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const logout = () => {
    clearStoredToken()
    router.push('/admin/login')
  }

  // The login page has no session to log out of yet: no sidebar, its own centered card.
  if (pathname === '/admin/login') {
    return (
      <AdminGate>
        <div className={CANVAS} dir="ltr">
          {children}
        </div>
      </AdminGate>
    )
  }

  return (
    <AdminGate>
      <div className={CANVAS} dir="ltr">
        <Sidebar open={menuOpen} onClose={closeMenu} onNavigate={dismissMenu} onLogout={logout} />
        <div className="flex min-h-dvh flex-col md:ps-64">
          <AdminHeader menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} menuButtonRef={menuButtonRef} />
          {/* Centred in the space beside the sidebar, capped so it doesn't stretch across wide monitors. */}
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 md:pt-8">
            {children}
          </main>
        </div>
      </div>
    </AdminGate>
  )
}
