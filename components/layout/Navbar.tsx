'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { auth } from '@/lib/firebase/config'
import { translations, Lang, TranslationKey } from '@/lib/i18n/translations'
import MobileMenu from './MobileMenu'

const LANGUAGES: { code: Lang; flag: string; label: string }[] = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'ru', flag: '🇷🇺', label: 'Русский' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'he', flag: '🇮🇱', label: 'עברית' },
]

/**
 * forceLocked: used on the /business page, which the legacy site always force-displays
 * in English with the language switcher disabled (lockLangForBusiness/unlockLangAfterBusiness
 * in the original index.html). It's a purely visual override — it never calls the real
 * setLang(), so the user's actual saved language preference is untouched.
 */
export default function Navbar({ forceLocked = false }: { forceLocked?: boolean }) {
  const { lang: ctxLang, setLang, t: ctxT } = useLang()
  const { user } = useAuth()
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const langDropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()

  const lang: Lang = forceLocked ? 'en' : ctxLang
  const t = (key: TranslationKey): string => (forceLocked ? translations.en[key] : ctxT(key))

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : ''
  }, [mobileMenuOpen])

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false)
      }
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [])

  const closeMobileMenu = () => setMobileMenuOpen(false)

  const handleSignOut = async () => {
    closeMobileMenu()
    await signOut(auth)
    router.push('/')
  }

  const goHome = () => {
    closeMobileMenu()
    if (pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      router.push('/')
    }
  }

  const toggleLangMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (forceLocked) return
    setLangMenuOpen((v) => !v)
  }

  const chooseLang = (code: Lang) => {
    if (forceLocked) return
    setLang(code)
    setLangMenuOpen(false)
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-[1000] bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <a href="/" onClick={(e) => { e.preventDefault(); goHome() }} className="flex items-center gap-2 flex-shrink-0 tap-target">
            <img src="/logo.jpg" alt="Landly" className="h-8 sm:h-9 w-auto" />
            <span className="font-black text-lg sm:text-xl text-brand tracking-tight">Landly</span>
          </a>

          <div className="hidden lg:flex items-center gap-6 text-[13px] font-semibold text-slate-600">
            <a href="/" onClick={(e) => { e.preventDefault(); goHome() }} className="hover:text-brand transition">{t('nav_home')}</a>
            <Link href="/#deals" className="hover:text-brand transition">{t('nav_deals')}</Link>
            <Link href="/#how" className="hover:text-brand transition">{t('nav_how')}</Link>
            <Link href="/#pricing" className="hover:text-brand transition">{t('nav_pricing')}</Link>
            <Link href="/olim" className="hover:text-brand transition">{t('nav_olim')}</Link>
            <Link href="/business" className="hover:text-brand transition">{t('nav_biz')}</Link>
            <Link href="/support" className="hover:text-brand transition">{t('nav_support')}</Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Language dropdown */}
            <div className="lang-dropdown" ref={langDropdownRef}>
              <button onClick={toggleLangMenu} className={`tap-target flex items-center gap-1.5 text-[13px] font-bold text-slate-600 border border-slate-200 rounded-full px-3 py-2 hover:border-brand hover:text-brand transition ${forceLocked ? 'lang-locked' : ''}`}>
                <i className="fa-solid fa-globe text-xs"></i>
                <span>{lang.toUpperCase()}</span>
                <i className="fa-solid fa-chevron-down text-[9px]"></i>
              </button>
              <div className={`lang-menu ${langMenuOpen ? 'show' : ''}`}>
                {LANGUAGES.map((l) => (
                  <div
                    key={l.code}
                    className={`lang-item ${lang === l.code ? 'active-lang' : ''}`}
                    onClick={() => chooseLang(l.code)}
                  >
                    <span>{l.flag}</span> {l.label}
                  </div>
                ))}
              </div>
            </div>

            {user && (
              <Link href="/member" className="hidden lg:flex tap-target items-center gap-1.5 text-[13px] font-bold text-brand border-2 border-brand rounded-full px-4 py-2 hover:bg-brandLight transition">
                <i className="fa-solid fa-gift text-xs"></i> <span>{t('nav_perks')}</span>
              </Link>
            )}
            <Link href="/#pricing" className="hidden sm:inline-flex tap-target bg-brand text-white text-[13px] font-bold px-5 py-2.5 rounded-full hover:bg-brandDark transition shadow-md">{t('nav_cta')}</Link>
            {user ? (
              <button onClick={handleSignOut} className="hidden sm:inline-flex tap-target items-center gap-1.5 text-[13px] font-bold text-slate-700 border-2 border-slate-200 rounded-full px-4 py-2.5 hover:border-brand hover:text-brand transition">
                <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i> <span>{t('nav_logout')}</span>
              </button>
            ) : (
              <Link href="/login" className="hidden sm:inline-flex tap-target items-center gap-1.5 text-[13px] font-bold text-slate-700 border-2 border-slate-200 rounded-full px-4 py-2.5 hover:border-brand hover:text-brand transition">
                <i className="fa-solid fa-user text-xs"></i> <span>{t('nav_login')}</span>
              </Link>
            )}

            {/* Hamburger (mobile/tablet only) */}
            <button className="lg:hidden tap-target flex items-center justify-center" onClick={() => setMobileMenuOpen((v) => !v)} aria-label="Menu">
              <div className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}><span></span><span></span><span></span></div>
            </button>
          </div>
        </div>
      </nav>

      <MobileMenu isOpen={mobileMenuOpen} onClose={closeMobileMenu} onGoHome={goHome} t={t} isLoggedIn={!!user} onSignOut={handleSignOut} />
    </>
  )
}
