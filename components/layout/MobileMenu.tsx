'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { TranslationKey } from '@/lib/i18n/translations'
import { isNavLinkActive } from '@/lib/navActive'
import { SUPPORT_EMAIL } from '@/lib/config'

// Text-only drawer (no icons): links up top, and the account actions, legal
// links and contact line pinned to the bottom of the screen. The drawer's height is
// set in globals.css (.mobile-menu, 100dvh minus the bar).
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
  const itemBase =
    'tap-target flex items-center justify-start min-h-[48px] px-3.5 py-2.5 rounded-xl text-start transition-colors [@media(hover:hover)]:hover:bg-slate-50 active:bg-slate-100'
  const navLinkClass = (href: string) =>
    `${itemBase} text-base font-bold ${isNavLinkActive(pathname, href, activeAnchorId) ? 'text-brand bg-brandLight' : 'text-[#0B1B3D]'}`
  const primaryClass =
    'tap-target flex items-center justify-center min-h-[48px] bg-brand text-white text-base font-bold rounded-xl px-5 hover:bg-brandDark transition-colors'

  return (
    <div className={`mobile-menu ${isOpen ? 'open' : ''}`}>
      <div className="min-h-full flex flex-col px-4 pt-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="flex flex-col gap-1">
          <a href="/" onClick={(e) => { e.preventDefault(); onGoHome() }} className={navLinkClass('/')}>{t('nav_home')}</a>
          {isLoggedIn ? (
            <>
              <Link href="/categories" onClick={onClose} className={navLinkClass('/categories')}>{t('nav_cta')}</Link>
              <Link href="/wishlist" onClick={onClose} className={navLinkClass('/wishlist')}>{t('nav_wishlist')}</Link>
              <Link href="/#how" onClick={onClose} className={navLinkClass('/#how')}>{t('nav_how')}</Link>
              <Link href="/olim" onClick={onClose} className={navLinkClass('/olim')}>{t('nav_olim')}</Link>
              <Link href="/support" onClick={onClose} className={navLinkClass('/support')}>{t('nav_support')}</Link>
              <Link href="/account" onClick={onClose} className={navLinkClass('/account')}>{t('nav_account')}</Link>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* mt-auto pins the account block to the bottom of the drawer */}
        <div className="mt-auto pt-6">
          {isLoggedIn ? (
            <>
              <Link href="/member" onClick={onClose} className={primaryClass}>{t('nav_perks')}</Link>
              <button onClick={onSignOut} className="tap-target w-full flex items-center justify-center min-h-[48px] mt-2 text-base font-bold text-red-600 rounded-xl [@media(hover:hover)]:hover:bg-red-50 active:bg-red-50 transition-colors">{t('nav_logout')}</button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={onClose} className={primaryClass}>{t('nav_login')}</Link>
              <p className="text-center text-sm text-slate-500 mt-2">
                {t('nav_new_to_landly')}{' '}
                <Link href="/signup" onClick={onClose} className="inline-block py-2 font-bold text-brand hover:underline">{t('signup_title')}</Link>
              </p>
            </>
          )}
          {/* Legal links: closing the drawer, then navigating */}
          <p className="mt-4 text-center text-xs text-slate-400">
            <Link href="/terms" onClick={onClose} className="inline-block py-1.5 text-slate-400 hover:text-slate-600 transition-colors">{t('nav_terms_link')}</Link>
            <span aria-hidden="true"> · </span>
            <Link href="/privacy" onClick={onClose} className="inline-block py-1.5 text-slate-400 hover:text-slate-600 transition-colors">{t('nav_privacy_link')}</Link>
          </p>
          <p className="mt-1 text-center text-xs text-slate-400">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-brand"><bdi>{SUPPORT_EMAIL}</bdi></a>
            <span aria-hidden="true"> · </span>
            <bdi>Landly Ltd.</bdi>
          </p>
        </div>
      </div>
    </div>
  )
}
