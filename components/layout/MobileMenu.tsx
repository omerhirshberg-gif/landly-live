'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { TranslationKey } from '@/lib/i18n/translations'
import { isNavLinkActive } from '@/lib/navActive'
import { SUPPORT_EMAIL } from '@/lib/config'
import Avatar from '@/components/ui/Avatar'
import { useAuth } from '@/lib/firebase/useAuth'
import { useMemberProfile } from '@/lib/firebase/useMemberProfile'
import { useWishlist } from '@/lib/firebase/useWishlist'

// The phone/tablet drawer (below lg). A member's drawer: who they are on top
// (a card that opens /account), the links with an icon each (Wishlist here,
// since the bar's heart is desktop-only, and Privacy & Security, which opens
// the SecurityDialog), the My Digital Pass banner (/member, where the active
// passes and their QR codes are), then Sign Out and the legal links pinned
// to the bottom above the safe area. Guests get text links, then Sign In.
// The drawer's height is set in globals.css (.mobile-menu, 100dvh minus the bar).
export default function MobileMenu({
  isOpen,
  onClose,
  onGoHome,
  t,
  isLoggedIn,
  onSignOut,
  onOpenSecurity,
  activeAnchorId,
}: {
  isOpen: boolean
  onClose: () => void
  /** Closes the drawer, then scrolls to the top on / or navigates there. */
  onGoHome: () => void
  t: (key: TranslationKey) => string
  isLoggedIn: boolean
  onSignOut: () => void
  /** Closes the drawer and opens Privacy & Security. */
  onOpenSecurity: () => void
  activeAnchorId: string | null
}) {
  const pathname = usePathname()
  const { wishlistIds } = useWishlist()
  const itemBase =
    'tap-target flex items-center justify-start min-h-[48px] px-3.5 py-2.5 rounded-xl text-start transition-colors [@media(hover:hover)]:hover:bg-slate-50 active:bg-slate-100'
  const navLinkClass = (href: string) =>
    `${itemBase} text-base font-bold ${isNavLinkActive(pathname, href, activeAnchorId) ? 'text-brand bg-brandLight' : 'text-[#0B1B3D]'}`
  const primaryClass =
    'tap-target flex items-center justify-center min-h-[48px] bg-brand text-white text-base font-bold rounded-xl px-5 hover:bg-brandDark transition-colors'
  const legal = (
    <p className="mt-4 text-center text-xs text-slate-400">
      <Link href="/terms" onClick={onClose} className="inline-block py-1.5 text-slate-400 hover:text-slate-600 transition-colors">{t('nav_terms_link')}</Link>
      <span aria-hidden="true"> · </span>
      <Link href="/privacy" onClick={onClose} className="inline-block py-1.5 text-slate-400 hover:text-slate-600 transition-colors">{t('nav_privacy_link')}</Link>
    </p>
  )

  return (
    <div className={`mobile-menu ${isOpen ? 'open' : ''}`}>
      <div className="min-h-full flex flex-col px-4 pt-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        {isLoggedIn ? (
          <>
            <MemberCard onClose={onClose} active={pathname === '/account'} label={t('nav_account')} cue={t('dash_tab_profile')} />

            {/* No Home here: the logo in the bar above is Home */}
            <div className="flex flex-col gap-1 mt-4">
              <IconLink href="/categories" icon="fa-gift" label={t('nav_cta')} onClose={onClose} className={navLinkClass('/categories')} />
              <IconLink href="/wishlist" icon="fa-heart" label={t('nav_wishlist')} onClose={onClose} className={navLinkClass('/wishlist')} count={wishlistIds.length} />
              <IconLink href="/olim" icon="fa-plane-departure" label={t('nav_olim')} onClose={onClose} className={navLinkClass('/olim')} />
              <IconLink href="/support" icon="fa-comment-dots" label={t('nav_support')} onClose={onClose} className={navLinkClass('/support')} />
              <button type="button" onClick={onOpenSecurity} className={`${itemBase} gap-3 text-base font-bold text-[#0B1B3D]`}>
                <ItemIcon icon="fa-shield-halved" />
                <span className="min-w-0 flex-1">{t('nav_security')}</span>
              </button>
            </div>

            <PassBanner onClose={onClose} title={t('nav_pass_title')} sub={t('nav_pass_sub')} />

            {/* mt-auto pins Sign Out and the legal links to the bottom of the drawer */}
            <div className="mt-auto pt-6">
              <button type="button" onClick={onSignOut} className="ds-btn ds-btn-secondary w-full">{t('nav_logout')}</button>
              {legal}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <a href="/" onClick={(e) => { e.preventDefault(); onGoHome() }} className={navLinkClass('/')}>{t('nav_home')}</a>
              {/* Guests browse the same catalog members do, before signing in */}
              <Link href="/categories" onClick={onClose} className={navLinkClass('/categories')}>{t('nav_deals')}</Link>
              <Link href="/#how" onClick={onClose} className={navLinkClass('/#how')}>{t('nav_how')}</Link>
              <Link href="/olim" onClick={onClose} className={navLinkClass('/olim')}>{t('nav_olim')}</Link>
              <Link href="/support" onClick={onClose} className={navLinkClass('/support')}>{t('nav_support')}</Link>
              {/* B2B sits apart from the consumer links, quieter, under its own divider */}
              <div className="mt-2 pt-2 border-t border-slate-100">
                <Link
                  href="/business"
                  onClick={onClose}
                  className={`${itemBase} text-[15px] font-semibold ${isNavLinkActive(pathname, '/business', activeAnchorId) ? 'text-brand bg-brandLight' : 'text-slate-500'}`}
                >
                  {t('nav_biz')}
                </Link>
              </div>
            </div>

            {/* mt-auto pins the sign-in block to the bottom of the drawer */}
            <div className="mt-auto pt-6">
              <Link href="/login" onClick={onClose} className={primaryClass}>{t('nav_login')}</Link>
              <p className="text-center text-sm text-slate-500 mt-2">
                {t('nav_new_to_landly')}{' '}
                <Link href="/signup" onClick={onClose} className="inline-block py-2 font-bold text-brand hover:underline">{t('signup_title')}</Link>
              </p>
              {legal}
              <p className="mt-1 text-center text-xs text-slate-400">
                <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-brand"><bdi>{SUPPORT_EMAIL}</bdi></a>
                <span aria-hidden="true"> · </span>
                <bdi>Landly</bdi>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// A 36px brand-tinted tile holding a link's Font Awesome glyph.
function ItemIcon({ icon }: { icon: string }) {
  return (
    <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-brandLight text-brand" aria-hidden="true">
      <i className={`fa-solid ${icon} text-sm`}></i>
    </span>
  )
}

function IconLink({ href, icon, label, onClose, className, count }: { href: string; icon: string; label: string; onClose: () => void; className: string; count?: number }) {
  return (
    <Link href={href} onClick={onClose} className={`${className} gap-3`}>
      <ItemIcon icon={icon} />
      <span className="min-w-0 flex-1">{label}</span>
      {!!count && (
        <span className="flex-shrink-0 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-brand text-white text-xs font-bold">{count}</span>
      )}
    </Link>
  )
}

// Who is signed in (avatar, full name, email) with a "Profile ›" cue; the
// whole card opens /account. It's the only way there on phones, where the
// navbar's avatar pill is hidden.
function MemberCard({ onClose, active, label, cue }: { onClose: () => void; active: boolean; label: string; cue: string }) {
  const { user } = useAuth()
  const { firstName, initials, photoURL, profile } = useMemberProfile(user)
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || firstName
  return (
    <Link
      href="/account"
      onClick={onClose}
      aria-current={active ? 'page' : undefined}
      className={`tap-target flex items-center gap-3 min-h-[64px] px-3.5 py-3 rounded-[14px] border transition-colors [@media(hover:hover)]:hover:bg-slate-50 active:bg-slate-50 ${active ? 'border-brand bg-brandLight' : 'border-line bg-white'}`}
    >
      <Avatar src={photoURL} initials={initials} size={48} />
      <span className="min-w-0 flex-1">
        {/* Screen readers hear "My Account" first; sighted members see who they are. */}
        <span className="sr-only">{label}: </span>
        {fullName && <span className="block truncate text-base font-bold text-ink">{fullName}</span>}
        {user?.email && <span className="block truncate text-sm text-body"><bdi>{user.email}</bdi></span>}
      </span>
      <span className="flex-shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-brandLight text-brand text-xs font-semibold" aria-hidden="true">
        {cue}
        <i className="fa-solid fa-chevron-right text-[9px] rtl:-scale-x-100"></i>
      </span>
    </Link>
  )
}

// The pass shortcut: a brand-gradient banner to /member, where the member's
// active passes and their QR codes are.
function PassBanner({ onClose, title, sub }: { onClose: () => void; title: string; sub: string }) {
  return (
    <Link
      href="/member"
      onClick={onClose}
      className="tap-target mt-4 flex items-center gap-3 px-4 py-3.5 rounded-[14px] bg-gradient-to-br from-brand to-brandDark text-white shadow-md transition-transform active:scale-[0.98] motion-reduce:transition-none"
    >
      <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-white/15" aria-hidden="true">
        <i className="fa-solid fa-qrcode"></i>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold">{title}</span>
        <span className="block text-sm text-white/80">{sub}</span>
      </span>
      <i className="fa-solid fa-chevron-right text-xs text-white/80 rtl:-scale-x-100" aria-hidden="true"></i>
    </Link>
  )
}
