'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Avatar from '@/components/ui/Avatar'
import { useAuth } from '@/lib/firebase/useAuth'
import { useMemberProfile } from '@/lib/firebase/useMemberProfile'
import { useLang } from '@/lib/i18n/useLang'
import type { TranslationKey } from '@/lib/i18n/translations'
import { ChevronDown, LogOut, QrCode, Settings, User, type LucideIcon } from 'lucide-react'

// The menu's link groups, top to bottom: the personal pages, then system and
// preferences. Privacy & Security isn't here: it's a row on /settings.
export const ACCOUNT_MENU_GROUPS: readonly (readonly { href: string; icon: LucideIcon; label: TranslationKey }[])[] = [
  [
    { href: '/profile', icon: User, label: 'nav_profile' },
    { href: '/member', icon: QrCode, label: 'nav_my_pass' },
  ],
  [{ href: '/settings', icon: Settings, label: 'nav_settings_heading' }],
]

// The signed-in member's navbar control: an avatar + first-name pill that
// opens a small menu: a header card (avatar, full name, email, Member badge),
// a divider, Profile and My Pass, Settings (/settings, where language,
// Privacy & Security and account deletion are), a divider, Sign Out, then
// Terms and Privacy (members get no marketing footer). The wishlist keeps its
// own heart icon beside the pill. Like the language menu, it's pinned under
// the trigger's right edge in every direction (the bar itself is locked LTR)
// while its contents read in the page direction.
export default function AccountMenu({ onSignOut }: { onSignOut: () => void }) {
  const { t, isRtl } = useLang()
  const { user } = useAuth()
  const { profile, firstName, initials, photoURL } = useMemberProfile(user)
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
  // The header card shows the full name; a display name that is really an email isn't one.
  const fullName =
    [profile?.displayName, user?.displayName].map((n) => n?.trim()).find((n) => n && !n.includes('@')) ??
    firstName ??
    t('nav_profile')

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('account_menu_label')}
        className="tap-target inline-flex items-center gap-2 h-11 ps-1 pe-3 rounded-full bg-white border border-line [@media(hover:hover)]:hover:border-slate-300 transition-colors"
      >
        <Avatar src={photoURL} initials={initials} size={34} />
        {/* The name drops out between lg and xl so the five centre links fit at 1024px */}
        <span dir={contentDir} className="hidden xl:inline max-w-[9rem] truncate text-meta font-semibold text-ink">
          {firstName ?? t('nav_profile')}
        </span>
        <ChevronDown aria-hidden="true" className={`h-3 w-3 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>

      {open && (
        <div dir={contentDir} role="menu" aria-label={t('account_menu_label')} className="account-menu">
          <div className="flex items-center gap-3 px-3 pt-2 pb-3">
            <Avatar src={photoURL} initials={initials} size={44} />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-ink">{fullName}</div>
              {user?.email && <div className="truncate text-xs text-muted"><bdi>{user.email}</bdi></div>}
              <span className="account-badge">{t('dash_segment_value_unset')}</span>
            </div>
          </div>
          <div className="account-divider" aria-hidden="true" />
          {ACCOUNT_MENU_GROUPS.map((group, i) => (
            <div key={i} role="group" className={i > 0 ? 'mt-1' : undefined}>
              {group.map((item) => (
                <Link key={item.href} role="menuitem" href={item.href} onClick={close} className="account-item">
                  <item.icon aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-brand" strokeWidth={1.75} />
                  <span>{t(item.label)}</span>
                </Link>
              ))}
            </div>
          ))}
          <div className="account-divider" aria-hidden="true" />
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              close()
              onSignOut()
            }}
            className="account-item account-item--danger"
          >
            <LogOut aria-hidden="true" className="h-4 w-4 flex-shrink-0 rtl:-scale-x-100" strokeWidth={1.75} />
            <span>{t('nav_logout')}</span>
          </button>
          <p className="px-3 pt-2 pb-1 mt-1 border-t border-line text-xs text-muted">
            <Link href="/terms" onClick={close} className="inline-block py-1.5 [@media(hover:hover)]:hover:text-brand">{t('nav_terms_link')}</Link>
            <span aria-hidden="true"> · </span>
            <Link href="/privacy" onClick={close} className="inline-block py-1.5 [@media(hover:hover)]:hover:text-brand">{t('nav_privacy_link')}</Link>
          </p>
        </div>
      )}
    </div>
  )
}
