'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Avatar from '@/components/ui/Avatar'
import SegmentBadge from '@/components/member/SegmentBadge'
import AnchoredPanel from './AnchoredPanel'
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

const ROW = 'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-medium text-ink transition-colors [@media(hover:hover)]:hover:bg-[#F0F7FF] [@media(hover:hover)]:hover:text-brand focus-visible:bg-[#F0F7FF] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand'
const ICON = 'h-[18px] w-[18px] flex-shrink-0 text-[#475569] transition-colors group-hover:text-brand'

// The signed-in member's navbar control: an avatar + first-name pill that
// opens a menu: a header card (avatar, full name, email, segment pill), then
// Profile and My Pass, Settings (/settings, where language, Privacy & Security
// and account deletion are), Sign Out, then Terms and Privacy (members get no
// marketing footer). The wishlist has its own heart beside the pill
// (WishlistPopover). The panel is a portal (AnchoredPanel): out of the frosted
// bar, so its text renders crisp. It is pinned under the trigger's right edge
// in every direction (the bar itself is locked LTR) while its contents read in
// the page direction.
export default function AccountMenu({ onSignOut }: { onSignOut: () => void }) {
  const { t, isRtl } = useLang()
  const { user } = useAuth()
  const { profile, firstName, initials, photoURL } = useMemberProfile(user)
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  // Navigating (a menu link, or the browser's back button) closes it.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const close = useCallback((returnFocus = false) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  const contentDir = isRtl ? 'rtl' : 'ltr'
  // The header card shows the full name; a display name that is really an email isn't one.
  const fullName =
    [profile?.displayName, user?.displayName].map((n) => n?.trim()).find((n) => n && !n.includes('@')) ??
    firstName ??
    t('nav_profile')

  return (
    <div className="relative">
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

      <AnchoredPanel open={open} onClose={close} anchorRef={triggerRef} width={288} dir={contentDir} role="menu" label={t('account_menu_label')}>
        <div className="flex items-center gap-3 border-b border-slate-200/80 bg-slate-50/80 p-4">
          <Avatar src={photoURL} initials={initials} size={36} className="ring-1 ring-slate-200" />
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-bold leading-snug text-ink">{fullName}</div>
            {user?.email && (
              <div className="truncate font-sans text-xs font-normal text-[#475569]">
                <bdi dir="ltr">{user.email}</bdi>
              </div>
            )}
            <div className="mt-1.5">
              <SegmentBadge customerType={profile?.customerType} customerTypeOther={profile?.customerTypeOther} />
            </div>
          </div>
        </div>
        <div className="p-1.5">
          {ACCOUNT_MENU_GROUPS.map((group, i) => (
            <div key={i} role="group" className={i > 0 ? 'mt-0.5' : undefined}>
              {group.map((item) => (
                <Link key={item.href} role="menuitem" href={item.href} onClick={() => close()} className={ROW}>
                  <item.icon aria-hidden="true" className={ICON} strokeWidth={1.75} />
                  <span>{t(item.label)}</span>
                </Link>
              ))}
            </div>
          ))}
          <div className="mt-1.5 border-t border-slate-200/80 pt-1.5">
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                close()
                onSignOut()
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start font-sans text-sm font-semibold text-rose-600 transition-colors [@media(hover:hover)]:hover:bg-rose-50/80 focus-visible:bg-rose-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rose-600"
            >
              <LogOut aria-hidden="true" className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.75} />
              <span>{t('nav_logout')}</span>
            </button>
          </div>
        </div>
        <p className="flex items-center justify-center gap-1 border-t border-slate-200/80 px-3 py-2 font-sans text-xs font-normal text-[#64748B]">
          <Link href="/terms" onClick={() => close()} className="inline-block py-1.5 transition-colors [@media(hover:hover)]:hover:text-ink">{t('nav_terms_link')}</Link>
          <span aria-hidden="true">·</span>
          <Link href="/privacy" onClick={() => close()} className="inline-block py-1.5 transition-colors [@media(hover:hover)]:hover:text-ink">{t('nav_privacy_link')}</Link>
        </p>
      </AnchoredPanel>
    </div>
  )
}
