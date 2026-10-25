'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import AdminGate from './AdminGate'
import AdminHeader from './AdminHeader'
import { DesktopSidebar, MobileDrawer } from './Sidebar'
import { clearStoredToken } from '@/lib/admin/adminSession'
import { useNeedsReplyCount } from '@/lib/admin/needsReply'

// The admin UI is English, so the portal is LTR even inside the Hebrew site.
// Layout classes are logical (ps/pe, start/end) and user data carries
// dir="auto", so Hebrew names render correctly inside it.
//
// From md: a row of the inline sidebar and the page. Below md: the page at
// full width under the header, whose ☰ opens the drawer (./Sidebar.tsx).
const CANVAS = 'min-h-[var(--app-dvh)] bg-gradient-to-b from-[#F8FAFC] to-[#F1F5F9] text-[#475569] antialiased'

// The sticky header's height, for pages that size themselves to the screen
// (AdminHeader): on phones a 3rem row between the notch (at least 0.75rem)
// and 0.75rem below; from md a 4rem row below the notch.
const SHELL_VARS = {
  '--admin-header-h': 'calc(max(env(safe-area-inset-top, 0px), 0.75rem) + 3.75rem)',
  '--admin-header-h-md': 'calc(4rem + env(safe-area-inset-top, 0px))',
} as React.CSSProperties

// Screens that fill the phone edge to edge below the header (the support
// inbox) instead of sitting in the padded, centred column; from md they're
// like every other page.
const FULL_BLEED = ['/admin/support']
const MAIN = 'mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 md:pt-8'
const MAIN_FULL_BLEED = 'flex w-full flex-1 flex-col md:mx-auto md:block md:max-w-6xl md:px-6 md:pt-8 md:pb-[max(2rem,env(safe-area-inset-bottom))]'

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  // WhatsApp chats waiting for the team: badges on the ☰ and the nav item.
  // The inbox announces its own count (lib/admin/needsReply.ts).
  const needsReply = useNeedsReplyCount(pathname !== '/admin/login', { follow: pathname.startsWith('/admin/support') })

  // Escape, the backdrop or the close button: focus goes back to the menu button.
  const closeMenu = useCallback(() => {
    setIsMobileOpen(false)
    menuButtonRef.current?.focus()
  }, [])
  // A nav link: focus follows the navigation instead.
  const dismissMenu = useCallback(() => setIsMobileOpen(false), [])

  // Any navigation (a link, back/forward) closes the drawer.
  useEffect(() => {
    setIsMobileOpen(false)
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
      <div className={`${CANVAS} flex`} style={SHELL_VARS} dir="ltr">
        <DesktopSidebar onLogout={logout} needsReply={needsReply} />
        <MobileDrawer open={isMobileOpen} onClose={closeMenu} onNavigate={dismissMenu} onLogout={logout} needsReply={needsReply} />
        <div className="flex min-h-[var(--app-dvh)] w-full min-w-0 flex-1 flex-col">
          <AdminHeader menuOpen={isMobileOpen} onOpenMenu={() => setIsMobileOpen(true)} menuButtonRef={menuButtonRef} needsReply={needsReply} />
          {/* Centred in the space beside the sidebar, capped so it doesn't stretch across wide monitors. */}
          <main className={FULL_BLEED.some((path) => pathname.startsWith(path)) ? MAIN_FULL_BLEED : MAIN}>
            {children}
          </main>
        </div>
      </div>
    </AdminGate>
  )
}
