'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'

export default function MobileMenu({
  isOpen,
  onClose,
  onGoHome,
}: {
  isOpen: boolean
  onClose: () => void
  onGoHome: () => void
}) {
  const { t } = useLang()

  return (
    <div className={`mobile-menu ${isOpen ? 'open' : ''}`}>
      <div className="flex flex-col p-5 gap-1">
        <a href="#hero" onClick={(e) => { e.preventDefault(); onGoHome() }} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_home')}</a>
        <a href="#deals" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_deals')}</a>
        <a href="#how" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_how')}</a>
        <a href="#pricing" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_pricing')}</a>
        <Link href="/olim" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_olim')}</Link>
        <Link href="/business" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_biz')}</Link>
        <Link href="/support" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_support')}</Link>
        <Link href="/login" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_perks')}</Link>
        <Link href="/login" onClick={onClose} className="tap-target flex justify-start text-base font-bold text-slate-800 py-3.5 border-b border-slate-100">{t('nav_login')}</Link>
        <a href="#pricing" onClick={onClose} className="tap-target bg-brand text-white text-base font-bold rounded-full py-4 mt-5 shadow-md text-center justify-center flex items-center">{t('nav_cta')}</a>
      </div>
    </div>
  )
}
