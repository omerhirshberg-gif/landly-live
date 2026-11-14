'use client'

import AdminEnvironmentBadge from './AdminEnvironmentBadge'
import AdminSettingsMenu from './AdminSettingsMenu'
import { useAdminT } from '@/lib/admin/translations'
import Breadcrumbs from './Breadcrumbs'
import LiveClock from './LiveClock'
import WhatsAppBadge from './WhatsAppBadge'
import { useAdminTrail } from './AdminCrumbContext'

interface AdminHeaderProps {
  menuOpen: boolean
  onOpenMenu: () => void
  /** Lets the shell hand focus back to the menu button when the drawer closes. */
  menuButtonRef: React.Ref<HTMLButtonElement>
  /** WhatsApp chats waiting for the team, badged on the ☰. */
  needsReply: number
  /** Sign out, from the settings menu. */
  onLogout: () => void
}

// Below md, three zones: the ☰ (with the WhatsApp badge on its corner), the
// page title centred on the screen (the breadcrumbs' last crumb, so a
// business's page shows its name), and the environment pill. The two side
// zones are the same width, so the title sits at the true centre whatever
// the pill says; the clock joins from 640px, muted, so it never crowds the
// edge. From md: breadcrumbs, then the environment label and the clock (lg), flat, with no pills.
// The settings gear (language, background, Sign out) ends every row.
//
// The header's height is the shell's --admin-header-h (phones) and
// --admin-header-h-md (AdminShell.tsx); change them together.
export default function AdminHeader({ menuOpen, onOpenMenu, menuButtonRef, needsReply, onLogout }: AdminHeaderProps) {
  const trail = useAdminTrail()
  const { t, tn, route } = useAdminT()

  return (
    <header className="sticky top-0 z-40 overflow-x-clip border-b border-adm-line/80 bg-adm-surface/95 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 backdrop-blur-md md:pt-[env(safe-area-inset-top)] md:pb-0">
      <div className="grid h-12 min-w-0 grid-cols-[6.5rem_minmax(0,1fr)_6.5rem] items-center gap-2 px-4 sm:grid-cols-[minmax(9rem,1fr)_minmax(0,auto)_minmax(9rem,1fr)] sm:px-6 md:flex md:h-16 md:gap-3 md:px-8">
        <div className="flex items-center md:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={onOpenMenu}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-adm-text transition-colors hover:bg-adm-raised active:bg-adm-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-adm-accent [-webkit-tap-highlight-color:transparent] md:hidden"
            aria-label={needsReply > 0 ? tn('nav.openMenuWhatsApp', needsReply) : t('nav.openMenu')}
            aria-controls="admin-drawer"
            aria-expanded={menuOpen}
          >
            <i className="fa-solid fa-bars text-lg" aria-hidden="true" />
            <WhatsAppBadge count={needsReply} className="absolute -end-1 -top-1" />
          </button>
        </div>

        <div className="min-w-0 md:flex-1">
          <span className="block truncate text-center text-base font-semibold text-adm-text sm:text-lg md:hidden" dir="auto">{route(trail[trail.length - 1]!.label)}</span>
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
          {/* Language, background and Sign out: one gear, on every screen size. */}
          <AdminSettingsMenu onLogout={onLogout} />
        </div>
      </div>
    </header>
  )
}
