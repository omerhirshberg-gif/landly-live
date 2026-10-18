'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: 'fa-gauge-high', exact: true },
  { href: '/admin/search', label: 'Search', icon: 'fa-magnifying-glass', exact: false },
  { href: '/admin/businesses', label: 'Businesses', icon: 'fa-store', exact: false },
  { href: '/admin/offers', label: 'Offers', icon: 'fa-tags', exact: false },
  { href: '/admin/orphans', label: 'Orphans', icon: 'fa-triangle-exclamation', exact: false },
] as const

// Tailwind's md breakpoint: from here the sidebar is always on screen.
const DESKTOP_QUERY = '(min-width: 768px)'

function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  )
}

interface SidebarProps {
  /** Mobile drawer state; the desktop sidebar ignores it. */
  open: boolean
  onClose: () => void
  /** A nav link was followed (closes the drawer without moving focus). */
  onNavigate: () => void
  onLogout: () => void
}

export default function Sidebar({ open, onClose, onNavigate, onLogout }: SidebarProps) {
  const pathname = usePathname()
  const isDesktop = useIsDesktop()
  const drawer = !isDesktop
  const panelRef = useRef<HTMLElement>(null)

  const isActive = (item: (typeof NAV_ITEMS)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  // As a drawer: Escape closes it, the page behind doesn't scroll, and focus
  // starts inside it.
  useEffect(() => {
    if (!drawer || !open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [drawer, open, onClose])

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-md transition-opacity duration-300 motion-reduce:transition-none md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        id="admin-sidebar"
        aria-label="Admin navigation"
        role={drawer && open ? 'dialog' : undefined}
        aria-modal={drawer && open ? true : undefined}
        // Off-screen drawer: keep its links out of the tab order and away from screen readers.
        inert={drawer && !open}
        className={`fixed inset-y-0 start-0 z-50 flex w-[min(18rem,85vw)] flex-col border-e border-[#E2E8F0] bg-white transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none md:w-64 md:translate-x-0 ${
          open ? 'translate-x-0 shadow-2xl md:shadow-none' : 'ltr:-translate-x-full rtl:translate-x-full'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[#E2E8F0] ps-5 pe-2 pt-[env(safe-area-inset-top)] box-content">
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]">
            <img src="/logo-mark.png" alt="" className="h-8 w-auto shrink-0" />
            <span className="text-lg font-bold leading-none text-[#0B1B3D]">Landly</span>
            <span className="rounded-full bg-[#F0F7FF] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#0038B8]">
              Admin
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[#475569] transition-colors hover:bg-[#F1F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8] md:hidden"
            aria-label="Close menu"
          >
            <i className="fa-solid fa-xmark text-lg" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8] ${
                      active
                        ? 'bg-[#F0F7FF] text-[#0038B8] before:absolute before:inset-y-2.5 before:start-0 before:w-[3px] before:rounded-full before:bg-[#0038B8]'
                        : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0B1B3D]'
                    }`}
                  >
                    <i className={`fa-solid ${item.icon} w-5 text-center text-sm`} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-[#E2E8F0] px-3 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#ECFDF5] px-3 py-2.5 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
            Signed in · Session active
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-[#475569] transition-colors hover:bg-[#FEF2F2] hover:text-[#B91C1C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]"
          >
            <i className="fa-solid fa-right-from-bracket w-5 text-center text-sm rtl:-scale-x-100" aria-hidden="true" />
            Log out
          </button>
        </div>
      </aside>
    </>
  )
}
