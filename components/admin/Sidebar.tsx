'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import WhatsAppBadge from './WhatsAppBadge'

// The admin navigation in its two forms, never both on one screen:
//
// - DesktopSidebar (md and up): inline in the shell's row, sticky and full
//   height, with its own scroll. Below md it is display:none.
// - MobileDrawer (below md): a fixed overlay with a blurred backdrop and a
//   panel that slides in from the left. It stays mounted so it can animate
//   out, and is inert (out of the tab order and the accessibility tree) while
//   closed. From md it is display:none.
//
// The admin is always LTR (AdminShell's dir="ltr"), even when the site
// language puts dir="rtl" on <html>. Tailwind's rtl: variant matches any
// descendant of a [dir="rtl"] element, so nothing here uses ltr:/rtl:
// variants: a closed drawer once slid onto the screen instead of off it.

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: 'fa-gauge-high', exact: true },
  { href: '/admin/support', label: 'WhatsApp Support', icon: 'fa-comments', exact: false },
  { href: '/admin/search', label: 'Search', icon: 'fa-magnifying-glass', exact: false },
  { href: '/admin/businesses', label: 'Businesses', icon: 'fa-store', exact: false },
  { href: '/admin/offers', label: 'Offers', icon: 'fa-tags', exact: false },
  { href: '/admin/orphans', label: 'Orphans', icon: 'fa-triangle-exclamation', exact: false },
] as const

// Tailwind's md breakpoint, where the inline sidebar takes over.
const DESKTOP_QUERY = '(min-width: 768px)'

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]'

interface NavProps {
  /** A nav link was followed (the drawer closes without moving focus). */
  onNavigate?: () => void
  onLogout: () => void
  /** The drawer's close button; the desktop sidebar has none. */
  onClose?: () => void
  /** WhatsApp chats waiting for the team, badged on "WhatsApp Support". */
  needsReply: number
}

/** Logo, links and logout: the same in the sidebar and the drawer. */
function NavContent({ onNavigate, onLogout, onClose, needsReply }: NavProps) {
  const pathname = usePathname()
  const isActive = (item: (typeof NAV_ITEMS)[number]) => (item.exact ? pathname === item.href : pathname.startsWith(item.href))

  return (
    <>
      <div className="box-content flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[#E2E8F0] ps-5 pe-2 pt-[env(safe-area-inset-top)] md:pt-0">
        <Link href="/admin" onClick={onNavigate} className={`flex min-h-12 min-w-0 items-center gap-2.5 rounded-lg ${FOCUS_RING}`}>
          <img src="/logo-mark.png" alt="" className="h-8 w-auto shrink-0" />
          <span className="text-lg font-bold leading-none text-[#0B1B3D]">Landly</span>
          <span className="rounded-full bg-[#F0F7FF] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#0038B8]">Admin</span>
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[#475569] transition-colors hover:bg-[#F1F5F9] active:bg-[#E2E8F0] ${FOCUS_RING}`}
            aria-label="Close menu"
          >
            <i className="fa-solid fa-xmark text-lg" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav aria-label="Admin sections" className="flex-1 overflow-y-auto overscroll-y-contain px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors ${FOCUS_RING} ${
                    active
                      ? 'bg-[#F0F7FF] text-[#0038B8] before:absolute before:inset-y-2.5 before:start-0 before:w-[3px] before:rounded-full before:bg-[#0038B8]'
                      : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0B1B3D] active:bg-[#F1F5F9]'
                  }`}
                >
                  <i className={`fa-solid ${item.icon} w-5 text-center text-sm`} aria-hidden="true" />
                  {item.label}
                  {item.href === '/admin/support' && <WhatsAppBadge count={needsReply} className="ms-auto" />}
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
          className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-[#475569] transition-colors hover:bg-[#FEF2F2] hover:text-[#B91C1C] active:bg-[#FEE2E2] ${FOCUS_RING}`}
        >
          <i className="fa-solid fa-right-from-bracket w-5 text-center text-sm" aria-hidden="true" />
          Log out
        </button>
      </div>
    </>
  )
}

/** The persistent sidebar, md and up only. */
export function DesktopSidebar({ onLogout, needsReply }: { onLogout: () => void; needsReply: number }) {
  return (
    <aside
      aria-label="Admin navigation"
      className="sticky top-0 hidden h-[var(--app-dvh)] w-64 shrink-0 flex-col border-e border-[#E2E8F0] bg-white md:flex"
    >
      <NavContent onLogout={onLogout} needsReply={needsReply} />
    </aside>
  )
}

interface MobileDrawerProps {
  open: boolean
  /** Escape, the backdrop, the close button, or growing past md. */
  onClose: () => void
  onNavigate: () => void
  onLogout: () => void
  needsReply: number
}

/** The slide-out menu behind the header's ☰, below md only. */
export function MobileDrawer({ open, onClose, onNavigate, onLogout, needsReply }: MobileDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // While open: Escape closes it, the page behind doesn't scroll, focus
  // starts on the close button, and widening to desktop closes it (the
  // sidebar takes over and the scroll lock must not linger).
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const media = window.matchMedia(DESKTOP_QUERY)
    const onWiden = () => {
      if (media.matches) onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    media.addEventListener('change', onWiden)
    panelRef.current?.querySelector<HTMLElement>('button, a')?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      media.removeEventListener('change', onWiden)
    }
  }, [open, onClose])

  return (
    <div
      id="admin-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Admin menu"
      inert={!open}
      // Hidden only once the slide-out has finished (visibility waits out the transition).
      className={`fixed inset-0 z-50 flex md:hidden ${open ? 'visible' : 'invisible delay-300'} transition-[visibility] motion-reduce:delay-0`}
    >
      <div
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`relative z-10 flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <NavContent onClose={onClose} onNavigate={onNavigate} onLogout={onLogout} needsReply={needsReply} />
      </div>
    </div>
  )
}
