'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useBusinessLang } from '@/lib/business/BusinessLangProvider'
import type { TranslationKey } from '@/lib/i18n/translations'

const NAV_ITEMS = [
  { href: '/business/dashboard', key: 'bizdash_nav_dashboard', icon: 'fa-gauge-high', exact: true },
  { href: '/business/dashboard/offers', key: 'bizdash_nav_offers', icon: 'fa-tags', exact: false },
  { href: '/business/dashboard/vouchers', key: 'bizdash_nav_vouchers', icon: 'fa-ticket', exact: false },
  { href: '/business/dashboard/history', key: 'bizdash_nav_history', icon: 'fa-clock-rotate-left', exact: false },
  { href: '/business/dashboard/support', key: 'bizdash_nav_support', icon: 'fa-life-ring', exact: false },
] satisfies { href: string; key: TranslationKey; icon: string; exact: boolean }[]

// Same structure as components/admin/Sidebar.tsx, but built with logical
// (start/end) properties instead of physical left/right ones -- the admin
// panel is forced dir="ltr" everywhere, while this dashboard is localized
// (see bizdash_* keys) and needs to flip sides correctly for Hebrew.
export default function Sidebar({ onLogout }: { onLogout: () => void }) {
  const { t, lang, setLang } = useBusinessLang()
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
        <Link href="/business/dashboard" className="flex items-center gap-2 min-w-0">
          <img src="/logo-mark.png" alt="Landly" className="h-7 w-auto shrink-0" />
          <span className="font-black text-white text-lg leading-none truncate">Landly</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-slate-300 shrink-0"
          aria-label="Open menu"
        >
          <i className="fa-solid fa-bars" aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 start-0 z-[9999] w-64 flex flex-col border-e border-white/10 bg-slate-950 transition-transform duration-200 md:translate-x-0 ${
          // Scoped to max-md so this never competes at desktop widths with
          // md:translate-x-0 above -- an earlier version mixed an unprefixed
          // -translate-x-full with rtl:translate-x-full for the mobile-closed
          // state, but [dir="rtl"] gives that rtl: class higher specificity
          // than md:translate-x-0, so it won the cascade even on desktop and
          // permanently hid the sidebar whenever the default (Hebrew) language
          // was active. Keeping both variants inside their own max-width media
          // query removes the conflict entirely instead of relying on specificity.
          open ? 'max-md:translate-x-0' : 'max-md:-translate-x-full max-md:rtl:translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <img src="/logo-mark.png" alt="Landly" className="h-8 w-auto" />
          <div className="flex items-center gap-2">
            <span className="font-black text-white text-lg leading-none">Landly</span>
            <span className="inline-flex items-center text-[11px] font-bold uppercase tracking-wide text-brand bg-brand/10 border border-brand/30 rounded-full px-2 py-0.5">
              Business
            </span>
          </div>
        </div>

        <div className="px-3 pt-3">
          <div className="flex rounded-lg border border-white/10 p-0.5 text-xs font-bold" role="group" aria-label="Dashboard language">
            <button
              onClick={() => setLang('he')}
              className={`flex-1 rounded-md py-1.5 transition-colors ${
                lang === 'he' ? 'bg-brand/10 text-brand' : 'text-slate-400 hover:text-white'
              }`}
            >
              עברית
            </button>
            <button
              onClick={() => setLang('en')}
              className={`flex-1 rounded-md py-1.5 transition-colors ${
                lang === 'en' ? 'bg-brand/10 text-brand' : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
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
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="relative z-10 px-3 pt-4 pb-6 border-t border-white/10 bg-slate-950">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-red-400 border border-transparent transition-colors hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/20"
          >
            <i className="fa-solid fa-right-from-bracket w-4 text-center" aria-hidden="true" />
            {t('bizdash_logout')}
          </button>
        </div>
      </aside>
    </>
  )
}
