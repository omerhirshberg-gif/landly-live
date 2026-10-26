import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import OfferMemberGate from '@/components/offers/OfferMemberGate'
import OfferGuestTeaser from '@/components/offers/OfferGuestTeaser'

const read = (path: string) => readFileSync(path, 'utf8')
// Text as React writes it into markup.
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function withLang(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}
const render = (lang: Lang, offerId: string) => withLang(lang, createElement(OfferMemberGate, { offerId }))

describe('offer member gate', () => {
  it.each(Object.keys(translations) as Lang[])('sends guests to sign in or join, then back to the offer (%s)', (lang) => {
    const html = render(lang, 'o1')
    const t = translations[lang]
    expect(html).toContain('href="/login?redirect=%2Foffers%2Fo1"')
    expect(html).toContain('href="/signup?redirect=%2Foffers%2Fo1"')
    expect(html).toContain(`<span>${esc(t.offer_gate_signin)}</span>`)
    expect(html).toContain(`>${esc(t.offer_gate_join)}</a>`)
    expect(html).not.toContain('/checkout')
  })

  it('uses the Hebrew copy from the brief', () => {
    expect(translations.he.offer_gate_signin).toBe('התחברו לקבלת גישה מלאה והטבה')
    expect(translations.en.offer_gate_signin).toBe('Sign in to claim and access deal')
    expect(translations.he.offer_teaser_message).toBe('המידע המלא, אופן המימוש והקודים זמינים בלעדית לחברי מועדון Landly רשומים.')
    expect(translations.he.offer_gate_join).toBe('עדיין אין לכם חשבון? הצטרפו בחינם')
  })

  it('encodes the offer id in the return path', () => {
    expect(render('en', 'a b/c')).toContain(`href="/login?redirect=${encodeURIComponent('/offers/a%20b%2Fc')}"`)
  })

  it('is what the offer page shows guests; checkout stays members-only', () => {
    const page = read('app/offers/[offerId]/page.tsx')
    expect(page).toContain('{!user && !authLoading && <OfferMemberGate offerId={offer.id} />}')
    expect(page).not.toContain('href="/login"')
    expect(page).toMatch(/\{user && !authLoading && !claimLoading && !alreadyClaimed && \([\s\S]*?\/checkout\?offerId=/)
  })
})

describe('offer guest teaser', () => {
  it.each(Object.keys(translations) as Lang[])('says the full details are for members (%s)', (lang) => {
    const t = translations[lang]
    const html = withLang(lang, createElement(OfferGuestTeaser))
    expect(html).toContain(`>${esc(t.offer_teaser_title)}</h2>`)
    expect(html).toContain(`>${esc(t.offer_teaser_message)}</p>`)
    expect(html).toContain('lucide-lock')
  })

  it('replaces How to redeem for guests only, and shortens the description', () => {
    const page = read('app/offers/[offerId]/page.tsx')
    // How to redeem renders only inside the member branch; the teaser only once auth says "guest".
    expect(page).toMatch(/\{user \? \([\s\S]*?<HowToRedeem[\s\S]*?\) : !authLoading && \([\s\S]*?<OfferGuestTeaser \/>/)
    expect(page.match(/<HowToRedeem/g)).toHaveLength(1)
    expect(page).toContain("${user ? '' : 'line-clamp-4'}")
  })
})

describe('guest home hero', () => {
  it('is only as tall as its content, close under the navbar', () => {
    const hero = read('components/home/Hero.tsx')
    expect(hero).not.toContain('min-h-screen')
    expect(hero).not.toContain('100dvh')
    expect(hero).toContain('pt-8 pb-8 sm:pt-12 sm:pb-10 lg:pt-14 lg:pb-12')
  })
})

describe('guest home background', () => {
  it('is the site canvas behind every section, none drawing its own edge', () => {
    expect(read('components/home/HomePage.tsx')).toContain('<main className="home-ambient">')
    const ambient = read('app/globals.css').match(/\.member-canvas,\.home-ambient\{[^}]*\}/)?.[0] ?? ''
    expect(ambient).toContain('linear-gradient(180deg,var(--canvas-wash) 0,var(--canvas) 420px) var(--canvas)')
    expect(ambient).not.toContain('radial-gradient(')
    expect(ambient).toContain('min-height:100dvh')
    // Floating cards: near-white glass over it.
    for (const file of ['ValueProps', 'PerkExampleCard']) expect(read(`components/home/${file}.tsx`)).toContain('bg-white/95 backdrop-blur-sm')
    // How It Works' slate-50 wash is the canvas's own colour, so it draws no edge either.
    expect(read('app/globals.css')).toContain(':root{--canvas:#F8FAFC;')
    expect(read('components/home/HowItWorks.tsx')).toContain('<section id="how" className="bg-slate-50 py-12 sm:py-14 lg:py-16">')
    // The navbar is translucent, so the sky tone shows through at the top.
    expect(read('components/layout/Navbar.tsx')).toContain('bg-white/70 backdrop-blur-md border-b border-line/60')
    expect(read('components/home/Hero.tsx')).not.toContain('radial-gradient')
    expect(read('components/home/ValueProps.tsx')).toContain('<section id="deals" className="py-12 sm:py-14 lg:py-16">')
    expect(read('components/home/PerkExamples.tsx')).toContain('className="py-12 sm:py-14 lg:py-16"')
    expect(read('components/home/HomeFaqPrompt.tsx')).toContain('py-8 sm:py-10 text-center">')
  })
})
