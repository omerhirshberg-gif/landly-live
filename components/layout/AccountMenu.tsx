'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Avatar from '@/components/ui/Avatar'
import { useAuth } from '@/lib/firebase/useAuth'
import { useMemberProfile } from '@/lib/firebase/useMemberProfile'
import { useLang } from '@/lib/i18n/useLang'

// The signed-in member's navbar control: an avatar + first-name pill that
// opens a small menu: My Perks, Profile (/account), Privacy & Security (the
// SecurityDialog), Sign Out, then Terms and Privacy (members get no marketing
// footer). The wishlist keeps its own heart icon beside the pill. Like the
// language menu, it's pinned under the trigger's right edge in every
// direction (the bar itself is locked LTR) while its contents read in the
// page direction.
export default function AccountMenu({ onSignOut, onOpenSecurity }: { onSignOut: () => void; onOpenSecurity: () => void }) {
  const { t, isRtl } = useLang()
  const { user } = useAuth()
  const { firstName, initials, photoURL } = useMemberProfile(user)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  // Navigating (a menu link, or the browser's back button) closes it.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    function handlePointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const contentDir = isRtl ? 'rtl' : 'ltr'
  const close = () => setOpen(false)

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('account_menu_label')}
        className="tap-target inline-flex items-center gap-2 h-11 ps-1 pe-3 rounded-full bg-white border border-line hover:border-slate-300 transition-colors"
      >
        <Avatar src={photoURL} initials={initials} size={34} />
        <span dir={contentDir} className="max-w-[9rem] truncate text-[13px] font-semibold text-ink">
          {firstName ?? t('nav_account')}
        </span>
        <i className={`fa-solid fa-chevron-down text-[9px] text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true"></i>
      </button>

      {open && (
        <div dir={contentDir} role="menu" aria-label={t('account_menu_label')} className="account-menu">
          <div className="flex items-center gap-3 px-3 pt-2 pb-3 mb-1 border-b border-line">
            <Avatar src={photoURL} initials={initials} size={40} />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-ink">{firstName ?? t('nav_account')}</div>
              {user?.email && <div className="truncate text-xs text-muted"><bdi>{user.email}</bdi></div>}
            </div>
          </div>
          <Link role="menuitem" href="/member" onClick={close} className="account-item">
            <i className="fa-solid fa-ticket w-4 text-brand" aria-hidden="true"></i>
            <span>{t('nav_perks')}</span>
          </Link>
          <Link role="menuitem" href="/account" onClick={close} className="account-item">
            <i className="fa-solid fa-user w-4 text-brand" aria-hidden="true"></i>
            <span>{t('dash_tab_profile')}</span>
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              close()
              onOpenSecurity()
            }}
            className="account-item"
          >
            <i className="fa-solid fa-shield-halved w-4 text-brand" aria-hidden="true"></i>
            <span>{t('nav_security')}</span>
          </button>
          <div className="my-1 h-px bg-line" aria-hidden="true" />
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              close()
              onSignOut()
            }}
            className="account-item !text-red-600"
          >
            <i className="fa-solid fa-arrow-right-from-bracket w-4 rtl:-scale-x-100" aria-hidden="true"></i>
            <span>{t('nav_logout')}</span>
          </button>
          <p className="px-3 pt-2 pb-1 mt-1 border-t border-line text-xs text-muted">
            <Link href="/terms" onClick={close} className="inline-block py-1.5 hover:text-brand">{t('nav_terms_link')}</Link>
            <span aria-hidden="true"> · </span>
            <Link href="/privacy" onClick={close} className="inline-block py-1.5 hover:text-brand">{t('nav_privacy_link')}</Link>
          </p>
        </div>
      )}
    </div>
  )
}
