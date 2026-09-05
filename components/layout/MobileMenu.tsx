'use client'

import Link from 'next/link'
import { TranslationKey } from '@/lib/i18n/translations'

export default function MobileMenu({
  isOpen,
  onClose,
  onGoHome,
  t,
  isLoggedIn,
  onSignOut,
}: {
  isOpen: boolean
  onClose: () => void
  onGoHome: () => void
  t: (key: TranslationKey) => string
  isLoggedIn: boolean
  onSignOut: () => void
}) {
  return (
    <div className={`mobile-menu ${isOpen ? 'open' : ''}`}>
      <div className="flex flex-col p-5 gap-1">
        <a href="/" onClick={(e) => { e.preventDefault(); onGoHome() }} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_home')}</a>
        {isLoggedIn ? (
          <>
            <Link href="/categories" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_cta')}</Link>
            <Link href="/wishlist" onClick={onClose} className="tap-target flex items-center gap-2 justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100"><i className="fa-solid fa-heart text-sm"></i> {t('nav_wishlist')}</Link>
            <Link href="/cart" onClick={onClose} className="tap-target flex items-center gap-2 justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100"><i className="fa-solid fa-cart-shopping text-sm"></i> {t('nav_cart')}</Link>
            <Link href="/#how" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_how')}</Link>
            <Link href="/#pricing" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_pricing')}</Link>
            <Link href="/olim" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_olim')}</Link>
            <Link href="/support" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_support')}</Link>
          </>
        ) : (
          <>
            <Link href="/#deals" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_deals')}</Link>
            <Link href="/#how" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_how')}</Link>
            <Link href="/#pricing" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_pricing')}</Link>
            <Link href="/olim" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_olim')}</Link>
            <Link href="/business" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_biz')}</Link>
            <Link href="/support" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_support')}</Link>
          </>
        )}
        {isLoggedIn ? (
          <button onClick={onSignOut} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_logout')}</button>
        ) : (
          <Link href="/login" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_login')}</Link>
        )}
        <Link href={isLoggedIn ? '/member' : '/#deals'} onClick={onClose} className="tap-target bg-brand text-white text-base font-bold rounded-full py-4 mt-5 shadow-md text-center justify-center flex items-center">{isLoggedIn ? t('nav_account') : t('nav_cta')}</Link>
      </div>
    </div>
  )
}
