'use client'

import { usePathname } from 'next/navigation'
import Breadcrumbs from './Breadcrumbs'
import LiveClock from './LiveClock'
import { getAdminPageTitle } from '@/lib/admin/pageTitle'

interface AdminHeaderProps {
  menuOpen: boolean
  onOpenMenu: () => void
  /** Lets the shell hand focus back to the menu button when the drawer closes. */
  menuButtonRef: React.Ref<HTMLButtonElement>
}

export default function AdminHeader({ menuOpen, onOpenMenu, menuButtonRef }: AdminHeaderProps) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 md:px-8">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onOpenMenu}
          className="-ms-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[#0B1B3D] transition-colors hover:bg-[#F1F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8] md:hidden"
          aria-label="Open menu"
          aria-controls="admin-sidebar"
          aria-expanded={menuOpen}
        >
          <i className="fa-solid fa-bars text-lg" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-[#0B1B3D] md:hidden">{getAdminPageTitle(pathname)}</span>
          <div className="hidden md:block">
            <Breadcrumbs />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="md:hidden">
            <LiveClock compact />
          </div>
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
