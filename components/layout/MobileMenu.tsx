'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TranslationKey } from '@/lib/i18n/translations'
import { isNavLinkActive } from '@/lib/navActive'

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
  onGoHome: () => void
  t: (key: TranslationKey) => string
  isLoggedIn: boolean
  onSignOut: () => void
  activeAnchorId: string | null
}) {
  const pathname = usePathname()
  const navLinkClass = (href: string) =>
    `tap-target flex items-center gap-2 justify-start text-base font-bold py-3.5 border-b border-slate-100 transition ${isNavLinkActive(pathname, href, activeAnchorId) ? 'text-brand bg-brandLight -mx-5 px-5' : 'text-slate-800'}`

  return (
    <div className={`mobile-menu ${isOpen ? 'open' : ''}`}>
      <div className="flex flex-col p-5 gap-1">
        <a href="/" onClick={(e) => { e.preventDefault(); onGoHome() }} className={navLinkClass('/')}>{t('nav_home')}</a>
        {isLoggedIn ? (
          <>
            <Link href="/categories" onClick={onClose} className={navLinkClass('/categories')}>{t('nav_cta')}</Link>
            <Link href="/wishlist" onClick={onClose} className={navLinkClass('/wishlist')}><i className="fa-solid fa-heart text-sm"></i> {t('nav_wishlist')}</Link>
            <Link href="/#how" onClick={onClose} className={navLinkClass('/#how')}>{t('nav_how')}</Link>
            <Link href="/olim" onClick={onClose} className={navLinkClass('/olim')}>{t('nav_olim')}</Link>
            <Link href="/support" onClick={onClose} className={navLinkClass('/support')}>{t('nav_support')}</Link>
            <Link href="/account" onClick={onClose} className={navLinkClass('/account')}>{t('dash_tab_profile')}</Link>
          </>
        ) : (
          <>
            <Link href="/#deals" onClick={onClose} className={navLinkClass('/#deals')}>{t('nav_deals')}</Link>
            <Link href="/#how" onClick={onClose} className={navLinkClass('/#how')}>{t('nav_how')}</Link>
            <Link href="/olim" onClick={onClose} className={navLinkClass('/olim')}>{t('nav_olim')}</Link>
            <Link href="/business" onClick={onClose} className={navLinkClass('/business')}>{t('nav_biz')}</Link>
            <Link href="/support" onClick={onClose} className={navLinkClass('/support')}>{t('nav_support')}</Link>
          </>
        )}
        {isLoggedIn ? (
          <button onClick={onSignOut} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_logout')}</button>
        ) : (
          <>
            <Link href="/login" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_login')}</Link>
            <Link href="/business/login" onClick={onClose} className="tap-target flex items-center gap-2 justify-start text-sm font-semibold text-slate-400 py-3.5 border-b border-slate-100"><i className="fa-solid fa-store text-xs"></i> {t('bizlogin_title')}</Link>
          </>
        )}
        <Link href={isLoggedIn ? '/member' : '/#deals'} onClick={onClose} className="tap-target bg-brand text-white text-base font-bold rounded-full py-4 mt-5 shadow-md text-center justify-center flex items-center">{isLoggedIn ? t('nav_perks') : t('nav_cta')}</Link>
      </div>
    </div>
  )
}
