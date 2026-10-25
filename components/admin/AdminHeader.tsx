'use client'

import { usePathname } from 'next/navigation'
import AdminEnvironmentBadge from './AdminEnvironmentBadge'
import Breadcrumbs from './Breadcrumbs'
import LiveClock from './LiveClock'
import WhatsAppBadge from './WhatsAppBadge'
import { getAdminPageTitle } from '@/lib/admin/pageTitle'

interface AdminHeaderProps {
  menuOpen: boolean
  onOpenMenu: () => void
  /** Lets the shell hand focus back to the menu button when the drawer closes. */
  menuButtonRef: React.Ref<HTMLButtonElement>
  /** WhatsApp chats waiting for the team, badged on the ☰. */
  needsReply: number
}

// Below md, three zones: the ☰ (with the WhatsApp badge on its corner), the
// page title centred on the screen, and the environment pill. The two side
// zones are the same width, so the title sits at the true centre whatever
// the pill says; the clock joins from 640px, muted, so it never crowds the
// edge. From md: breadcrumbs, then the pill, the clock (lg) and the session.
//
// The header's height is the shell's --admin-header-h (phones) and
// --admin-header-h-md (AdminShell.tsx); change them together.
export default function AdminHeader({ menuOpen, onOpenMenu, menuButtonRef, needsReply }: AdminHeaderProps) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 overflow-x-clip border-b border-slate-200/80 bg-white/95 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur-md md:pt-[env(safe-area-inset-top)] md:pb-0">
      <div className="grid h-12 min-w-0 grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 px-4 sm:grid-cols-[minmax(9rem,1fr)_minmax(0,auto)_minmax(9rem,1fr)] sm:px-6 md:flex md:h-16 md:gap-3 md:px-8">
        <div className="flex items-center md:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={onOpenMenu}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[#0B1B3D] transition-colors hover:bg-slate-100 active:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8] [-webkit-tap-highlight-color:transparent] md:hidden"
            aria-label={needsReply > 0 ? `Open menu, ${needsReply} WhatsApp chat${needsReply === 1 ? '' : 's'} need a reply` : 'Open menu'}
            aria-controls="admin-drawer"
            aria-expanded={menuOpen}
          >
            <i className="fa-solid fa-bars text-lg" aria-hidden="true" />
            <WhatsAppBadge count={needsReply} className="absolute -end-1 -top-1" />
          </button>
        </div>

        <div className="min-w-0 md:flex-1">
          <span className="block truncate text-center text-base font-semibold text-slate-900 sm:text-lg md:hidden">{getAdminPageTitle(pathname)}</span>
          <div className="hidden md:block">
            <Breadcrumbs />
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3 md:shrink-0">
          <div className="hidden sm:block md:hidden">
            <LiveClock compact muted />
          </div>
          <AdminEnvironmentBadge />
          <div className="hidden lg:block">
            <LiveClock />
          </div>
          <span className="hidden h-10 items-center gap-2 rounded-full bg-[#F0F7FF] px-4 text-sm font-semibold text-[#0038B8] md:inline-flex">
            <i className="fa-solid fa-shield-halved text-xs" aria-hidden="true" />
            Admin session
          </span>
        </div>
      </div>
    </header>
  )
}
