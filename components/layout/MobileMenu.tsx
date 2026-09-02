'use client'

import Link from 'next/link'
import { TranslationKey } from '@/lib/i18n/translations'

export default function MobileMenu({
  isOpen,
  onClose,
  onGoHome,
  t,
}: {
  isOpen: boolean
  onClose: () => void
  onGoHome: () => void
  t: (key: TranslationKey) => string
}) {
  return (
    <div className={`mobile-menu ${isOpen ? 'open' : ''}`}>
      <div className="flex flex-col p-5 gap-1">
        <a href="/" onClick={(e) => { e.preventDefault(); onGoHome() }} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_home')}</a>
        <Link href="/#deals" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_deals')}</Link>
        <Link href="/#how" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_how')}</Link>
        <Link href="/#pricing" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_pricing')}</Link>
        <Link href="/olim" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_olim')}</Link>
        <Link href="/business" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_biz')}</Link>
        <Link href="/support" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_support')}</Link>
        <Link href="/login" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_perks')}</Link>
        <Link href="/login" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_login')}</Link>
        <Link href="/#pricing" onClick={onClose} className="tap-target bg-brand text-white text-base font-bold rounded-full py-4 mt-5 shadow-md text-center justify-center flex items-center">{t('nav_cta')}</Link>
      </div>
    </div>
  )
}
