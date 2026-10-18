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

// The phone/tablet drawer (below lg), where the bar is only the logo and the
// hamburger. A member's drawer, top to bottom: who they are (a card that
// opens /profile), the product links (Home, My Pass, Explore Perks, Wishlist,
// Making Aliyah?), a Settings link to /settings (language, Privacy &
// Security, support, legal and account deletion live there), then Sign Out
// in a footer that sticks above the safe area. Guests get the text links,
// the same Settings link, then Sign In.
// The drawer's height is set in globals.css (.mobile-menu, 100dvh minus the bar).
export default function MobileMenu({
  isOpen,
  onClose,
  onGoHome,
  t,
  isLoggedIn,
  onSignOut,
  activeAnchorId,
}: {
  isOpen: boolean
  onClose: () => void
  /** Closes the drawer, then scrolls to the top on / or navigates there. */
  onGoHome: () => void
  t: (key: TranslationKey) => string
  isLoggedIn: boolean
  onSignOut: () => void
  activeAnchorId: string | null
}) {
  const pathname = usePathname()
  const { wishlistIds } = useWishlist()

  const itemBase =
    'tap-target flex items-center justify-start min-h-[48px] px-3.5 py-2.5 rounded-xl text-start transition-colors [@media(hover:hover)]:hover:bg-slate-50 active:bg-slate-100'
  const navLinkClass = (href: string) =>
    `${itemBase} text-base font-bold ${isNavLinkActive(pathname, href, activeAnchorId) ? 'text-brand bg-brandLight' : 'text-[#0B1B3D]'}`
  const memberLinkClass = (href: string) =>
    `${rowBase} text-[15px] font-semibold ${isNavLinkActive(pathname, href, activeAnchorId) ? 'text-brand bg-brandLight' : 'text-ink'}`
  const primaryClass =
    'tap-target flex items-center justify-center min-h-[48px] bg-brand text-white text-base font-bold rounded-xl px-5 hover:bg-brandDark transition-colors'

  // Settings and each of its sub-pages count as "here".
  const inSettings = isNavLinkActive(pathname, '/settings', null)
  const settingsLink = (
    <div className="mt-6 mb-6">
      <Link
        href="/settings"
        onClick={onClose}
        aria-current={inSettings ? 'page' : undefined}
        className={`${rowBase} text-[15px] font-semibold ${inSettings ? 'bg-brandLight text-brand' : 'text-ink'}`}
      >
        <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-600" aria-hidden="true">
          <i className="fa-solid fa-gear text-sm" aria-hidden="true"></i>
        </span>
        <span className="min-w-0 flex-1">{t('nav_settings_heading')}</span>
        <i className="fa-solid fa-chevron-right flex-shrink-0 text-xs text-slate-400 rtl:-scale-x-100" aria-hidden="true"></i>
      </Link>
    </div>
  )

  return (
    <div id="mobile-menu" className={`mobile-menu ${isOpen ? 'open' : ''}`}>
      {isLoggedIn ? (
        // No bottom padding here: the sticky footer carries the safe-area inset.
        <div className="min-h-full flex flex-col px-4 pt-4">
          <MemberCard onClose={onClose} active={pathname === '/profile'} label={t('nav_profile')} />

          <div className="flex flex-col gap-1 mt-4">
            <a href="/" onClick={(e) => { e.preventDefault(); onGoHome() }} className={memberLinkClass('/')}>
              <ItemIcon icon="fa-house" />
              <span className="min-w-0 flex-1">{t('nav_home')}</span>
            </a>
            {/* My Pass opens /member, where the active passes and their QR codes are */}
            <IconLink href="/member" icon="fa-qrcode" label={t('nav_my_pass')} onClose={onClose} className={memberLinkClass('/member')} />
            <IconLink href="/categories" icon="fa-gift" label={t('nav_cta')} onClose={onClose} className={memberLinkClass('/categories')} />
            <IconLink href="/wishlist" icon="fa-heart" label={t('nav_wishlist')} onClose={onClose} className={memberLinkClass('/wishlist')} count={wishlistIds.length} />
            <IconLink href="/olim" icon="fa-plane-departure" label={t('nav_olim')} onClose={onClose} className={memberLinkClass('/olim')} />
          </div>

          {settingsLink}

          {/* mt-auto pins Sign Out to the bottom when the drawer is short;
              sticky keeps it in reach when the drawer scrolls */}
          <div
            className="sticky bottom-0 -mx-4 mt-auto border-t border-slate-100 bg-white/95 backdrop-blur-sm px-4 pt-3"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            <button
              type="button"
              onClick={onSignOut}
              className="tap-target flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white text-[15px] font-semibold text-red-600 transition-colors [@media(hover:hover)]:hover:bg-red-50 active:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-sm rtl:-scale-x-100" aria-hidden="true"></i>
              {t('nav_logout')}
            </button>
          </div>
        </div>
      ) : (
        <div className="min-h-full flex flex-col px-4 pt-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
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

          {/* Language, Terms and Privacy are on /settings, for guests too */}
          {settingsLink}

          {/* mt-auto pins the sign-in block to the bottom of the drawer */}
          <div className="mt-auto pt-6">
            <Link href="/login" onClick={onClose} className={primaryClass}>{t('nav_login')}</Link>
            <p className="text-center text-sm text-slate-500 mt-2">
              {t('nav_new_to_landly')}{' '}
              <Link href="/signup" onClick={onClose} className="inline-block py-2 font-bold text-brand hover:underline">{t('signup_title')}</Link>
            </p>
            <p className="mt-3 text-center text-xs text-slate-400">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-brand"><bdi>{SUPPORT_EMAIL}</bdi></a>
              <span aria-hidden="true"> · </span>
              <bdi>Landly</bdi>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// The 48px row shared by the member links and the Settings link.
const rowBase =
  'tap-target flex items-center gap-3 min-h-[48px] px-3 py-2 rounded-xl text-start transition-colors [@media(hover:hover)]:hover:bg-slate-50 active:bg-slate-100'

// A 36px brand-tinted tile holding a link's Font Awesome glyph.
function ItemIcon({ icon }: { icon: string }) {
  return (
    <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-brandLight text-brand" aria-hidden="true">
      <i className={`fa-solid ${icon} text-sm`} aria-hidden="true"></i>
    </span>
  )
}

function IconLink({ href, icon, label, onClose, className, count }: { href: string; icon: string; label: string; onClose: () => void; className: string; count?: number }) {
  return (
    <Link href={href} onClick={onClose} className={className}>
      <ItemIcon icon={icon} />
      <span className="min-w-0 flex-1">{label}</span>
      {!!count && (
        <span className="flex-shrink-0 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-brand text-white text-xs font-bold">{count}</span>
      )}
    </Link>
  )
}

// Who is signed in: just the avatar and full name; the whole card opens
// /profile. It's the only way there on phones and tablets, where the
// navbar's avatar pill is hidden. A member with no name on file sees
// "Profile" in its place.
function MemberCard({ onClose, active, label }: { onClose: () => void; active: boolean; label: string }) {
  const { user } = useAuth()
  const { firstName, initials, photoURL, profile } = useMemberProfile(user)
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || firstName
  return (
    <Link
      href="/profile"
      onClick={onClose}
      aria-current={active ? 'page' : undefined}
      className={`tap-target flex items-center gap-3 rounded-2xl border p-4 transition-colors [@media(hover:hover)]:hover:bg-slate-100/80 active:bg-slate-100 ${active ? 'border-brand/30 bg-brandLight' : 'border-slate-100 bg-slate-50'}`}
    >
      <Avatar src={photoURL} initials={initials} size={44} className="ring-2 ring-white shadow-[0_0_0_3px_#e2e8f0]" />
      <span className="min-w-0 flex-1 truncate text-[16px] font-bold text-ink">
        {fullName ? (
          <>
            {/* Screen readers hear "Profile" first; sighted members see who they are. */}
            <span className="sr-only">{label}: </span>
            {fullName}
          </>
        ) : (
          label
        )}
      </span>
    </Link>
  )
}
