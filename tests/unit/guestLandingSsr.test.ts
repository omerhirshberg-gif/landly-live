import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { translations, type TranslationKey } from '@/lib/i18n/translations'

// The home page's server HTML must carry the guest landing while Firebase
// Auth hasn't answered (it never has on the server), so a guest whose
// JavaScript is slow or never runs still sees the page.
const authState = { user: null as { uid: string } | null, loading: true }

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: () => {}, replace: () => {} }) }))
vi.mock('@/lib/firebase/useAuth', () => ({ useAuth: () => authState }))
vi.mock('@/components/auth/useOnboardingGuard', () => ({ useOnboardingGuard: () => false }))
vi.mock('@/components/layout/Navbar', () => ({ default: () => 'NAVBAR' }))
vi.mock('@/components/layout/Footer', () => ({ default: () => 'FOOTER' }))
vi.mock('@/components/home/LoggedInHome', () => ({ default: () => 'MEMBER_DASHBOARD' }))

const { default: HomePage } = await import('@/components/home/HomePage')

const render = () => {
  const t = (key: TranslationKey) => translations.en[key]
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang: 'en', setLang: () => {}, t, isRtl: false } }, createElement(HomePage)))
}

describe('home page while Auth is loading (the server render)', () => {
  it('carries the whole guest landing, hero heading included, beside the member shell', () => {
    authState.user = null
    authState.loading = true
    const html = render()
    expect(html).toContain('<h1')
    expect(html).toContain('class="home-ambient"')
    expect(html).toContain('FOOTER')
    expect(html).toContain('class="member-shell below-header member-canvas"')
    expect(html).toContain('class="guest-while-loading"')
    expect(html).not.toContain('MEMBER_DASHBOARD')
    // The shell comes first, then the landing it stands in for.
    expect(html.indexOf('member-shell')).toBeLessThan(html.indexOf('guest-while-loading'))
  })

  it('drops the shell and the hideable wrapper once a guest is known', () => {
    authState.loading = false
    const html = render()
    expect(html).toContain('<h1')
    expect(html).not.toContain('member-shell')
    expect(html).not.toContain('guest-while-loading')
  })

  it('shows a member only their dashboard', () => {
    authState.user = { uid: 'u1' }
    authState.loading = false
    const html = render()
    expect(html).toContain('MEMBER_DASHBOARD')
    expect(html).not.toContain('<h1')
    authState.user = null
  })
})

describe('member hint plumbing', () => {
  const layout = readFileSync('app/layout.tsx', 'utf8')
  const css = readFileSync('app/globals.css', 'utf8')
  const home = readFileSync('components/home/HomePage.tsx', 'utf8')

  it('runs the hint script in <head>, before the first paint, and tolerates its class at hydration', () => {
    expect(layout).toMatch(/<html [^>]*suppressHydrationWarning>/)
    expect(layout).toMatch(/<head>[\s\S]*?<script dangerouslySetInnerHTML=\{\{ __html: MEMBER_HINT_SCRIPT \}\} \/>[\s\S]*?<\/head>/)
  })

  it('shows the landing by default and only the shell for a returning member', () => {
    expect(css).toContain('.member-shell{display:none;pointer-events:none;}')
    expect(css).toContain('html.member-hint .member-shell{display:block;}')
    expect(css).toContain('html.member-hint .guest-while-loading{display:none;}')
    // Nothing else may hide the landing (it must show with no JavaScript at all).
    expect(css.match(/guest-while-loading/g)).toHaveLength(1)
  })

  it('wraps every section under the hero, and the floating widgets, in a SectionBoundary', () => {
    for (const name of ['partner-marquee', 'value-props', 'savings-showcase', 'how-it-works', 'pass-showcase', 'faq-prompt']) {
      expect(home).toContain(`<SectionBoundary name="${name}">`)
    }
    expect(home).toMatch(/<Hero \/>\n\s*<SectionBoundary/)
    for (const name of ['accessibility-widget', 'route-tracker', 'whatsapp-widget', 'cookie-notice', 'passkey-prompt']) {
      expect(layout).toContain(`<SectionBoundary name="${name}">`)
    }
  })
})
