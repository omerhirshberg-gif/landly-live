'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { SUPPORT_EMAIL } from '@/lib/config'

export default function Footer({
  onOpenTerms,
  onOpenRaffleTerms,
}: {
  onOpenTerms: () => void
  onOpenRaffleTerms: () => void
}) {
  const { t } = useLang()
  const { user } = useAuth()

  return (
    <footer className="bg-slate-900 text-slate-400 py-12 sm:py-14 px-5 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between gap-10 mb-10 sm:mb-12">
          <div className="max-w-xs">
            <div className="flex items-center gap-2 mb-4">
              <img src="/logo-mark.png" alt="Landly" className="h-10 w-auto" />
              <span className="font-black text-white text-xl">Landly</span>
            </div>
            <p className="text-sm leading-relaxed">{t('footer_tagline')}</p>
            <p className="text-xs mt-3">{SUPPORT_EMAIL} · <span>{t('footer_location')}</span></p>
            <p className="text-xs mt-1 text-slate-500">{t('footer_copyright_notice')}</p>
            <div className="mt-5">
              <div className="text-[11px] font-bold tracking-widest text-slate-500 uppercase mb-2.5">{t('footer_follow')}</div>
              <div className="flex items-center gap-2.5">
                <a href="https://instagram.com/golandly" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="tap-target w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                  <i className="fa-brands fa-instagram text-white text-base"></i>
                </a>
                <a href="https://www.facebook.com/share/1DU2BKFA9d/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="tap-target w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                  <i className="fa-brands fa-facebook text-white text-base"></i>
                </a>
                <a href="https://www.linkedin.com/company/golandly/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="tap-target w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                  <i className="fa-brands fa-linkedin text-white text-base"></i>
                </a>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
            <div>
              <div className="font-bold text-white mb-3">{t('footer_col_product')}</div>
              <ul className="space-y-2">
                <li><a href="#hero" className="hover:text-white transition">{t('nav_home')}</a></li>
                <li><a href="#deals" className="hover:text-white transition">{t('nav_deals')}</a></li>
                <li><a href="#how" className="hover:text-white transition">{t('nav_how')}</a></li>
                <li><a href="#pricing" className="hover:text-white transition">{t('nav_pricing')}</a></li>
                <li><Link href={user ? '/member' : '/login'} className="hover:text-white transition">{t('nav_perks')}</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-bold text-white mb-3">{t('footer_col_pages')}</div>
              <ul className="space-y-2">
                <li><Link href="/olim" className="hover:text-white transition">{t('nav_olim')}</Link></li>
                <li><Link href="/business" className="hover:text-white transition">{t('nav_biz')}</Link></li>
                <li><Link href="/categories" className="hover:text-white transition">{t('footer_all_categories')}</Link></li>
                <li><Link href="/support" className="hover:text-white transition">{t('nav_support')}</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-bold text-white mb-3">{t('footer_col_legal')}</div>
              <ul className="space-y-2">
                <li><button onClick={onOpenTerms} className="hover:text-white transition">{t('terms_link')}</button></li>
                <li><button onClick={onOpenRaffleTerms} className="hover:text-white transition">{t('footer_raffle_rules')}</button></li>
                <li><a href="#faq" className="hover:text-white transition">{t('faq_label_short')}</a></li>
              </ul>
            </div>
            <div>
              <div className="font-bold text-white mb-3">{t('footer_col_download')}</div>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition flex items-center gap-1.5"><i className="fa-brands fa-apple text-xs"></i> <span>{t('footer_appstore')}</span></a></li>
                <li><a href="#" className="hover:text-white transition flex items-center gap-1.5"><i className="fa-brands fa-google-play text-xs"></i> <span>{t('footer_googleplay')}</span></a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-6 text-xs text-center">© {new Date().getFullYear()} Landly · <span>{t('footer_location')}</span> · <span>{t('footer_copyright_suffix')}</span> · <span>{t('footer_copyright_notice')}</span></div>
      </div>
    </footer>
  )
}
