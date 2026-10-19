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
import AccountMenu from './AccountMenu'
import MobileMenu from './MobileMenu'

// The only homepage section the navbar scroll-spies on — Deals now goes to the
// /categories catalog instead of the #deals overview.
const HOME_ANCHOR_IDS = ['how'] as const

export default function Navbar() {
  const { lang, setLang, t, isRtl } = useLang()
  const { user } = useAuth()
  const { wishlistCount } = useWishlist()
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const langDropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()

  const contentDir = isRtl ? 'rtl' : 'ltr'

  const activeAnchorId = useScrollSpy(HOME_ANCHOR_IDS, pathname === '/')

  const isActive = (href: string) => isNavLinkActive(pathname, href, activeAnchorId)
  // Hover tints only where there's a real pointer, so a tap never leaves one stuck on.
  const navLinkClass = (href: string) =>
    `transition truncate py-3 ${isActive(href) ? 'text-brand font-bold underline decoration-2 underline-offset-[9px]' : '[@media(hover:hover)]:hover:text-brand'}`
  const ariaCurrent = (href: string) => (isActive(href) ? ('page' as const) : undefined)

  // Both account pills share size and shape; the transparent border keeps the
  // blue one exactly as tall as the outlined one.
  const pillBase = 'tap-target inline-flex items-center text-[13px] font-bold px-4 py-2 rounded-full border transition-colors'
  const accountPillClass = `${pillBase} bg-brand text-white border-transparent [@media(hover:hover)]:hover:bg-brandDark shadow-md`
  const accountSecondaryPillClass = `${pillBase} bg-[#FFFFFF] text-[#0B1B3D] border-[#E2E8F0] [@media(hover:hover)]:hover:border-slate-300 [@media(hover:hover)]:hover:text-brand`

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
      <nav className="navbar-safe-top fixed top-0 left-0 right-0 z-[1000] bg-white/70 backdrop-blur-md border-b border-line/60 shadow-sm">
        {/* The bar's physical order is locked in every language: logo on the
            left, language switcher and hamburger on the right (below lg it's
            just the logo and the hamburger; the drawer holds the rest). dir="ltr" stops
            Hebrew's html[dir=rtl] from mirroring it; the centre links get the
            page direction back so they still read in the language's order.
            From lg it's three columns, the outer two equal, so the links sit
            in the true centre of the bar rather than of the space between the
            logo and the (wider) account controls. */}
        <div dir="ltr" className="relative max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 lg:grid lg:grid-cols-[1fr_minmax(0,max-content)_1fr] lg:gap-6">
          <a href="/" onClick={(e) => { e.preventDefault(); goHome() }} className="flex items-center gap-2 flex-shrink-0 tap-target justify-self-start">
            <img src="/logo-mark.png" alt="Landly" className="h-9 sm:h-10 w-auto" />
            <span className="font-black text-lg sm:text-xl text-brand tracking-tight">Landly</span>
          </a>

          <div dir={contentDir} className="hidden lg:flex min-w-0 items-center justify-center gap-3 xl:gap-6 whitespace-nowrap text-[13px] font-semibold text-slate-600">
            {user ? (
              <>
                {/* Members get Home, Explore Perks, Wishlist, My Pass,
                    Making Aliyah? and Support; "How it works" is a guest section they never see */}
                <a href="/" onClick={(e) => { e.preventDefault(); goHome() }} aria-current={ariaCurrent('/')} className={navLinkClass('/')}>{t('nav_home')}</a>
                <Link href="/categories" aria-current={ariaCurrent('/categories')} className={navLinkClass('/categories')}>{t('nav_cta')}</Link>
                <WishlistNavLink count={wishlistCount} active={isActive('/wishlist')} label={t('nav_wishlist')} />
                <Link href="/member" aria-current={ariaCurrent('/member')} className={navLinkClass('/member')}>{t('nav_my_pass')}</Link>
                <Link href="/olim" aria-current={ariaCurrent('/olim')} className={navLinkClass('/olim')}>{t('nav_olim')}</Link>
                <Link href="/support" aria-current={ariaCurrent('/support')} className={navLinkClass('/support')}>{t('nav_support')}</Link>
              </>
            ) : (
              <>
                <a href="/" onClick={(e) => { e.preventDefault(); goHome() }} aria-current={ariaCurrent('/')} className={navLinkClass('/')}>{t('nav_home')}</a>
                <Link href="/categories" aria-current={ariaCurrent('/categories')} className={navLinkClass('/categories')}>{t('nav_deals')}</Link>
                <Link href="/#how" aria-current={ariaCurrent('/#how')} className={navLinkClass('/#how')}>{t('nav_how')}</Link>
                <Link href="/olim" aria-current={ariaCurrent('/olim')} className={navLinkClass('/olim')}>{t('nav_olim')}</Link>
                {/* From 1280px: below that, the guest bar has no room for a seventh
                    link in Russian, Spanish or French, so About is in the footer
                    (and, under 1024px, the drawer). */}
                <Link href="/about" aria-current={ariaCurrent('/about')} className={`${navLinkClass('/about')} hidden xl:inline`}>{t('nav_about')}</Link>
                <Link href="/business" aria-current={ariaCurrent('/business')} className={navLinkClass('/business')}>{t('nav_partner')}</Link>
                <Link href="/support" aria-current={ariaCurrent('/support')} className={navLinkClass('/support')}>{t('nav_support')}</Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 justify-self-end">
            {/* Account actions (desktop only): the blue and white capsules (signed out) or the avatar pill (signed in), then a hairline before the language picker */}
            <div className="hidden lg:flex items-center gap-4">
              {user ? (
                // Avatar + name pill; Profile, My Pass, Settings and Sign Out live in its menu
                <AccountMenu onSignOut={handleSignOut} />
              ) : (
                <>
                  {/* Sign Up is the blue pill; Sign In the white one beside the language switcher */}
                  <Link href="/signup" className={accountPillClass}>{t('signup_title')}</Link>
                  <Link href="/login" className={accountSecondaryPillClass}>{t('nav_login')}</Link>
                </>
              )}
            </div>
            <div className="hidden lg:block h-4 w-[1px] bg-slate-200 mx-1" aria-hidden="true" />

            {/* Language dropdown — the menu is pinned under the trigger's right
                edge inline, overriding globals.css's html[dir=rtl] left:0 rule
                (written for when the switcher sat on the left in Hebrew). Desktop only:
                below lg the drawer's Language & Region row replaces it */}
            <div className="lang-dropdown hidden lg:block" ref={langDropdownRef}>
              {/* A plain trigger (no capsule) so it doesn't compete with the account buttons */}
              <button
                type="button"
                onClick={toggleLangMenu}
                aria-expanded={langMenuOpen}
                aria-haspopup="true"
                className="tap-target flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 rounded-lg px-2.5 py-1.5 [@media(hover:hover)]:hover:bg-slate-100 [@media(hover:hover)]:hover:text-[#0B1B3D] transition-colors"
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
            <button type="button" className="lg:hidden tap-target flex items-center justify-center" onClick={() => setMobileMenuOpen((v) => !v)} aria-label="Menu" aria-expanded={mobileMenuOpen} aria-controls="mobile-menu">
              <div className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}><span></span><span></span><span></span></div>
            </button>
          </div>
        </div>
      </nav>

      <MobileMenu isOpen={mobileMenuOpen} onClose={closeMobileMenu} onGoHome={goHome} t={t} isLoggedIn={!!user} onSignOut={handleSignOut} activeAnchorId={activeAnchorId} />
    </>
  )
}

// The members' Wishlist link: the label truncates on its own so the saved
// count beside it is never clipped, and the active underline sits on the
// label only. The badge follows the label in reading order (start/end
// margins), so in Hebrew it's on the label's left.
function WishlistNavLink({ count, active, label }: { count: number; active: boolean; label: string }) {
  return (
    <Link
      href="/wishlist"
      aria-current={active ? 'page' : undefined}
      className={`inline-flex min-w-0 items-center gap-1.5 py-3 transition ${active ? 'text-brand font-bold' : '[@media(hover:hover)]:hover:text-brand'}`}
    >
      <span className={active ? 'truncate underline decoration-2 underline-offset-[9px]' : 'truncate'}>{label}</span>
      {count > 0 && (
        <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1.5 inline-flex items-center justify-center rounded-full bg-brand text-white text-[10px] font-bold leading-none tabular-nums">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
