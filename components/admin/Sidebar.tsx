'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LiveClock from './LiveClock'
import { getAdminPageTitle } from '@/lib/admin/pageTitle'

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: 'fa-gauge-high', exact: true },
  { href: '/admin/search', label: 'Search', icon: 'fa-magnifying-glass', exact: false },
  { href: '/admin/businesses', label: 'Businesses', icon: 'fa-store', exact: false },
  { href: '/admin/offers', label: 'Offers', icon: 'fa-tags', exact: false },
  { href: '/admin/orphans', label: 'Orphans', icon: 'fa-triangle-exclamation', exact: false },
] as const

export default function Sidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const isActive = (item: (typeof NAV_ITEMS)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  return (
    <>
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <Link href="/admin" className="flex items-center gap-2 min-w-0">
          <img src="/logo-mark.png" alt="Landly" className="h-7 w-auto shrink-0" />
          <span className="font-black text-white text-lg leading-none truncate">{getAdminPageTitle(pathname)}</span>
        </Link>
        <div className="flex items-center gap-3">
          <LiveClock compact />
          <button
            onClick={() => setOpen(true)}
            className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-slate-300 shrink-0"
            aria-label="Open menu"
          >
            <i className="fa-solid fa-bars" aria-hidden="true" />
          </button>
        </div>
      </div>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[9999] w-64 flex flex-col border-r border-white/10 bg-slate-950 transition-transform duration-200 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <img src="/logo-mark.png" alt="Landly" className="h-8 w-auto" />
          <div className="flex items-center gap-2">
            <span className="font-black text-white text-lg leading-none">Landly</span>
            <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wide text-brand bg-brand/10 border border-brand/30 rounded-full px-2 py-0.5">
              Admin
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive(item)
                  ? 'bg-brand/10 text-brand border border-brand/30'
                  : 'text-slate-400 border border-transparent hover:text-white hover:bg-white/5'
              }`}
            >
              <i className={`fa-solid ${item.icon} w-4 text-center`} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="relative z-10 px-3 pt-4 pb-6 border-t border-white/10 bg-slate-950">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-red-400 border border-transparent transition-colors hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/20"
          >
            <i className="fa-solid fa-right-from-bracket w-4 text-center" aria-hidden="true" />
            Logout
          </button>
        </div>
      </aside>
    </>
  )
}
