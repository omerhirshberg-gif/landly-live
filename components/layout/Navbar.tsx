'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { useWishlist } from '@/lib/firebase/useWishlist'
import { isNavLinkActive } from '@/lib/navActive'
import { useScrollSpy } from '@/lib/useScrollSpy'
import { auth } from '@/lib/firebase/config'
import { updateUserLanguage } from '@/lib/firebase/users'
import type { Lang } from '@/lib/i18n/translations'
import { LANGUAGES } from '@/lib/i18n/languages'
import MobileMenu from './MobileMenu'

// The only sections the navbar itself links to (Footer's own #hero link is
// out of scope) — order matters for useScrollSpy's tie-breaking.
const HOME_ANCHOR_IDS = ['deals', 'how'] as const

export default function Navbar() {
  const { lang, setLang, t, isRtl } = useLang()
  const { user } = useAuth()
  const { wishlistIds } = useWishlist()
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const langDropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()

  const contentDir = isRtl ? 'rtl' : 'ltr'

  const activeAnchorId = useScrollSpy(HOME_ANCHOR_IDS, pathname === '/')

  const navLinkClass = (href: string) =>
    `transition ${isNavLinkActive(pathname, href, activeAnchorId) ? 'text-brand font-bold underline decoration-2 underline-offset-[9px]' : 'hover:text-brand'}`

  // Both account pills share size and shape; the transparent border keeps the
  // blue one exactly as tall as the outlined one.
  const pillBase = 'tap-target inline-flex items-center text-[13px] font-bold px-4 py-2 rounded-full border transition-colors'
  const accountPillClass = `${pillBase} bg-brand text-white border-transparent hover:bg-brandDark shadow-md`
  const accountSecondaryPillClass = `${pillBase} bg-[#FFFFFF] text-[#0B1B3D] border-[#E2E8F0] hover:border-slate-300 hover:text-brand`

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : ''
  }, [mobileMenuOpen])

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setLangMenuOpen(false)
    }
    document.addEventListener('click', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('click', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
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
    setLangMenuOpen((v) => !v)
  }

  const chooseLang = (code: Lang) => {
    setLang(code)
    setLangMenuOpen(false)
    if (user) updateUserLanguage(user.uid, code)
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-[1000] bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
        {/* The bar's physical order is locked in every language: logo on the
            left, language switcher and hamburger on the right. dir="ltr" stops
            Hebrew's html[dir=rtl] from mirroring it; the centre links get the
            page direction back so they still read in the language's order. */}
        <div dir="ltr" className="relative max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <a href="/" onClick={(e) => { e.preventDefault(); goHome() }} className="flex items-center gap-2 flex-shrink-0 tap-target">
            <img src="/logo-mark.png" alt="Landly" className="h-9 sm:h-10 w-auto" />
            <span className="font-black text-lg sm:text-xl text-brand tracking-tight">Landly</span>
          </a>

          <div dir={contentDir} className="hidden lg:flex flex-1 min-w-0 items-center justify-center gap-4 xl:gap-6 whitespace-nowrap text-[13px] font-semibold text-slate-600">
            <a href="/" onClick={(e) => { e.preventDefault(); goHome() }} className={navLinkClass('/')}>{t('nav_home')}</a>
            {user ? (
              <>
                <Link href="/categories" className={navLinkClass('/categories')}>{t('nav_cta')}</Link>
                <Link href="/#how" className={navLinkClass('/#how')}>{t('nav_how')}</Link>
                <Link href="/olim" className={navLinkClass('/olim')}>{t('nav_olim')}</Link>
                <Link href="/support" className={navLinkClass('/support')}>{t('nav_support')}</Link>
                <Link href="/account" className={navLinkClass('/account')}>{t('nav_account')}</Link>
              </>
            ) : (
              <>
                <Link href="/#deals" className={navLinkClass('/#deals')}>{t('nav_deals')}</Link>
                <Link href="/#how" className={navLinkClass('/#how')}>{t('nav_how')}</Link>
                <Link href="/olim" className={navLinkClass('/olim')}>{t('nav_olim')}</Link>
                <Link href="/business" className={navLinkClass('/business')}>{t('nav_biz')}</Link>
                <Link href="/support" className={navLinkClass('/support')}>{t('nav_support')}</Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {user && (
              <Link href="/wishlist" aria-label={t('nav_wishlist')} className={`tap-target relative flex items-center justify-center w-10 h-10 rounded-full transition ${isNavLinkActive(pathname, '/wishlist', activeAnchorId) ? 'text-brand bg-brandLight' : 'text-slate-600 hover:text-brand'}`}>
                <i className="fa-solid fa-heart text-base"></i>
                {wishlistIds.length > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-brand text-white text-[9px] font-bold">{wishlistIds.length}</span>
                )}
              </Link>
            )}

            {/* Account actions: the blue and white capsules, then a hairline before the language picker */}
            <div className="hidden sm:flex items-center gap-4">
              {user ? (
                <>
                  <Link href="/member" className={accountPillClass}>{t('nav_perks')}</Link>
                  <button onClick={handleSignOut} className="tap-target inline-flex items-center gap-1.5 text-[13px] font-bold text-red-600 border-2 border-red-200 rounded-full px-4 py-2.5 hover:bg-red-50 hover:border-red-600 transition">
                    <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i> <span>{t('nav_logout')}</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Sign Up is the blue pill; Sign In the white one beside the language switcher */}
                  <Link href="/signup" className={accountPillClass}>{t('signup_title')}</Link>
                  <Link href="/login" className={accountSecondaryPillClass}>{t('nav_login')}</Link>
                </>
              )}
            </div>
            <div className="hidden sm:block h-4 w-[1px] bg-slate-200 mx-1" aria-hidden="true" />

            {/* Language dropdown — the menu is pinned under the trigger's right
                edge inline, overriding globals.css's html[dir=rtl] left:0 rule
                (written for when the switcher sat on the left in Hebrew) */}
            <div className="lang-dropdown" ref={langDropdownRef}>
              {/* A plain trigger (no capsule) so it doesn't compete with the account buttons */}
              <button
                type="button"
                onClick={toggleLangMenu}
                aria-expanded={langMenuOpen}
                aria-haspopup="true"
                className="tap-target flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 rounded-lg px-2.5 py-1.5 hover:bg-slate-100 hover:text-[#0B1B3D] transition-colors"
              >
                <i className="fa-solid fa-globe text-xs" aria-hidden="true"></i>
                <span>{lang.toUpperCase()}</span>
                <i className={`fa-solid fa-chevron-down text-[9px] transition-transform duration-200 ${langMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true"></i>
              </button>
              <div dir={contentDir} className={`lang-menu ${langMenuOpen ? 'show' : ''}`} style={{ right: 0, left: 'auto' }}>
                {/* Real buttons, so the options are reachable by keyboard */}
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    lang={l.code}
                    aria-current={lang === l.code || undefined}
                    className={`lang-item w-full text-start ${lang === l.code ? 'active-lang' : ''}`}
                    onClick={() => chooseLang(l.code)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hamburger (mobile/tablet only) */}
            <button className="lg:hidden tap-target flex items-center justify-center" onClick={() => setMobileMenuOpen((v) => !v)} aria-label="Menu">
              <div className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}><span></span><span></span><span></span></div>
            </button>
          </div>
        </div>
      </nav>

      <MobileMenu isOpen={mobileMenuOpen} onClose={closeMobileMenu} onGoHome={goHome} t={t} isLoggedIn={!!user} onSignOut={handleSignOut} activeAnchorId={activeAnchorId} />
    </>
  )
}
