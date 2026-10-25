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
// in a footer that sticks above the safe area. Guests get the same icon rows
// for the public pages (Partner with Us among them, after Making Aliyah?), the
// same Settings link, then Sign In. Language is switched from the globe in the
// bar (guests) or on /settings, so the drawer carries no switcher of its own.
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
  const { wishlistCount } = useWishlist()

  const linkClass = (href: string) =>
    `${rowBase} text-[15px] font-semibold ${isNavLinkActive(pathname, href, activeAnchorId) ? 'text-brand bg-brandLight' : 'text-ink'}`
  const primaryClass = 'ds-btn ds-btn-primary ds-btn-md w-full'

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
    <>
      {/* On an unfolded foldable (600-1023px) the drawer is a side panel, not a
          full-screen sheet; this scrim over the rest of the page closes it
          on a tap. Hidden on phones, where the drawer covers the screen (globals.css). */}
      <div aria-hidden="true" className={`mobile-menu-scrim ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div id="mobile-menu" className={`mobile-menu ${isOpen ? 'open' : ''}`}>
        {isLoggedIn ? (
          // No bottom padding here: the sticky footer carries the safe-area inset.
          <div className="min-h-full flex flex-col px-4 pt-4">
            <MemberCard onClose={onClose} active={pathname === '/profile'} label={t('nav_profile')} />

            <div className="flex flex-col gap-1 mt-4">
              <a href="/" onClick={(e) => { e.preventDefault(); onGoHome() }} className={linkClass('/')}>
                <ItemIcon icon="fa-house" />
                <span className="min-w-0 flex-1">{t('nav_home')}</span>
              </a>
              {/* My Pass opens /member, where the active passes and their QR codes are */}
              <IconLink href="/member" icon="fa-qrcode" label={t('nav_my_pass')} onClose={onClose} className={linkClass('/member')} />
              <IconLink href="/categories" icon="fa-gift" label={t('nav_cta')} onClose={onClose} className={linkClass('/categories')} />
              <IconLink href="/wishlist" icon="fa-heart" label={t('nav_wishlist')} onClose={onClose} className={linkClass('/wishlist')} count={wishlistCount} />
              <IconLink href="/olim" icon="fa-plane-departure" label={t('nav_olim')} onClose={onClose} className={linkClass('/olim')} />
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
                className="tap-target flex h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-red-200 bg-white text-[15px] font-semibold text-red-600 transition-colors [@media(hover:hover)]:hover:bg-red-50 active:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
              >
                <i className="fa-solid fa-arrow-right-from-bracket text-sm rtl:-scale-x-100" aria-hidden="true"></i>
                {t('nav_logout')}
              </button>
            </div>
          </div>
        ) : (
          <div className="min-h-full flex flex-col px-4 pt-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <div className="flex flex-col gap-1">
              <a href="/" onClick={(e) => { e.preventDefault(); onGoHome() }} className={linkClass('/')}>
                <ItemIcon icon="fa-house" />
                <span className="min-w-0 flex-1">{t('nav_home')}</span>
              </a>
              {/* Guests browse the same catalog members do, before signing in */}
              <IconLink href="/categories" icon="fa-gift" label={t('nav_deals')} onClose={onClose} className={linkClass('/categories')} />
              <IconLink href="/#how" icon="fa-list-check" label={t('nav_how')} onClose={onClose} className={linkClass('/#how')} />
              <IconLink href="/olim" icon="fa-plane-departure" label={t('nav_olim')} onClose={onClose} className={linkClass('/olim')} />
              {/* B2B onboarding, for guests only: members are consumers and never see it */}
              <IconLink href="/business" icon="fa-handshake" label={t('nav_partner')} onClose={onClose} className={linkClass('/business')} />
              <IconLink href="/about" icon="fa-circle-info" label={t('nav_about')} onClose={onClose} className={linkClass('/about')} />
              <IconLink href="/support" icon="fa-headset" label={t('nav_support')} onClose={onClose} className={linkClass('/support')} />
            </div>

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
    </>
  )
}

// The 48px row shared by the drawer's icon links and the Settings link.
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
      {/* The saved count, only when there is one: an empty wishlist shows the plain row. */}
      {count !== undefined && count > 0 && (
        <span className="flex-shrink-0 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-brand text-white text-xs font-bold tabular-nums">{count > 99 ? '99+' : count}</span>
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
