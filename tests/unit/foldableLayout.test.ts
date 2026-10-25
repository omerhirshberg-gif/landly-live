import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { COVER_MAX_WIDTH, DESKTOP_MIN_WIDTH, FOLD_MIN_WIDTH, MODAL_MAX_WIDTH, webFormFactor } from '@/lib/layout/foldable'
vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {} }))

import { OFFER_FEED_GRID } from '@/components/discover/OfferCard'

const read = (path: string) => readFileSync(path, 'utf8')
const tailwind = createRequire(import.meta.url)('../../tailwind.config.js')

describe('foldable breakpoints', () => {
  it.each([
    [344, 'cover'], // Galaxy Z Fold cover screen
    [379, 'cover'],
    [380, 'phone'],
    [412, 'phone'],
    [599, 'phone'],
    [600, 'unfolded'],
    [707, 'unfolded'], // Galaxy Z Fold inner screen
    [841, 'unfolded'], // Pixel Fold inner screen
    [1023, 'unfolded'],
    [1024, 'desktop'],
    [1440, 'desktop'],
  ] as const)('lays a %ipx viewport out as %s', (width, factor) => {
    expect(webFormFactor(width)).toBe(factor)
  })

  it('anchors the unfolded layout at Android’s 600 large-screen line, below md', () => {
    expect(FOLD_MIN_WIDTH).toBe(600)
    expect(COVER_MAX_WIDTH).toBeLessThan(FOLD_MIN_WIDTH)
    expect(DESKTOP_MIN_WIDTH).toBe(1024)
    expect(MODAL_MAX_WIDTH).toBe(540)
  })
})

describe('tailwind screens', () => {
  const screens = tailwind.theme.screens as Record<string, unknown>

  it('puts fold (600px) first, ahead of the default screens, so the min-width cascade holds', () => {
    expect(Object.keys(screens)).toEqual(['fold', 'sm', 'md', 'lg', 'xl', '2xl'])
    expect(screens.fold).toBe(`${FOLD_MIN_WIDTH}px`)
    expect(screens.lg).toBe(`${DESKTOP_MIN_WIDTH}px`)
    expect(tailwind.theme.extend.screens).toBeUndefined()
  })

  it('keeps every screen a plain min-width, so Tailwind still generates max-md: and the other max-* variants', () => {
    for (const value of Object.values(screens)) expect(typeof value).toBe('string')
    expect(read('components/business/Sidebar.tsx')).toMatch(/max-md:/)
  })
})

describe('foldable web layout', () => {
  it('sets viewport-fit=cover and resizes-content on every page from the root layout', () => {
    const layout = read('app/layout.tsx')
    expect(layout).toMatch(/export const viewport: Viewport = \{\s*width: 'device-width',\s*initialScale: 1,\s*viewportFit: 'cover',\s*interactiveWidget: 'resizes-content',\s*\}/)
  })

  it('steps the header and the pages below it clear of the side safe-area insets', () => {
    expect(read('app/globals.css')).toContain('.below-header,.navbar-safe-top{padding-left:env(safe-area-inset-left, 0px);padding-right:env(safe-area-inset-right, 0px);}')
  })

  it('shows two perks per row from 600px and three on desktop, one on phones and cover screens', () => {
    expect(OFFER_FEED_GRID).toBe('grid grid-cols-1 gap-3 fold:grid-cols-2 fold:gap-4 lg:grid-cols-3')
    expect(OFFER_FEED_GRID).not.toMatch(/\bmd:grid-cols-2\b/)
  })

  it('keeps the hinge gap in plain CSS, reported only where the browser sees two viewport segments', () => {
    const css = read('app/globals.css')
    expect(css).toContain(':root{--pane-gap:24px;--hinge-gap:0px;}')
    expect(css).toMatch(/@media \(horizontal-viewport-segments:2\)\{\s*:root\{--hinge-gap:calc\(env\(viewport-segment-left 1 0, 0px\) - env\(viewport-segment-right 0 0, 0px\)\);\}/)
    expect(css).toContain('column-gap:max(var(--pane-gap),var(--hinge-gap))')
    expect(css).not.toContain('screen-spanning')
  })

  it('bounds the modal box and turns the navbar drawer into a side panel with a closing scrim when unfolded', () => {
    const css = read('app/globals.css')
    expect(css).toContain('@media(min-width:600px) and (max-width:1023.98px){.modal-box{max-width:540px;')
    expect(css).toMatch(/@media \(min-width:600px\) and \(max-width:1023\.98px\)\{\s*\.mobile-menu\{left:auto;width:min\(400px,100%\);/)
    expect(css).toContain('html[dir="rtl"] .mobile-menu{left:0;right:auto;')
    const menu = read('components/layout/MobileMenu.tsx')
    expect(menu).toContain("<div aria-hidden=\"true\" className={`mobile-menu-scrim ${isOpen ? 'open' : ''}`} onClick={onClose} />")
  })

  it('gives a landscape inner screen the split sign-in screen; landscape phones are too short for it', () => {
    const css = read('components/auth/entrance/entrance.module.css')
    expect(css).toContain('@media (min-width: 1024px), (min-width: 600px) and (min-aspect-ratio: 1/1) and (min-height: 560px) {')
    expect(css).toMatch(/@media \(horizontal-viewport-segments: 2\) and \(min-width: 600px\) \{\s*\.brandPanel \{\s*flex-basis: env\(viewport-segment-width 0 0, 42%\);/)
  })

  it('splits the offer page into photo and details panes from 600px, desktop included, leaving phones alone', () => {
    const page = read('app/offers/[offerId]/page.tsx')
    expect(page).toContain('mx-auto max-w-2xl fold:max-w-4xl')
    expect(page).toContain('<div className="fold:grid fold:grid-cols-2 fold:items-start">')
  })

  it.each(['components/member/PerksTab.tsx', 'components/member/RedeemedTab.tsx'])('%s lists passes two to a row when unfolded, one centred column elsewhere', (path) => {
    expect(read(path)).toContain('<ul className="mx-auto grid max-w-xl gap-3 fold:max-lg:max-w-none fold:max-lg:grid-cols-2">')
  })

  it('caps the home pass card from 600px so it never stretches across an inner screen', () => {
    expect(read('components/home/LoggedInHome.tsx')).toContain('flex w-full flex-col fold:max-w-xl md:min-h-[200px]')
  })
})

describe('two-pane profile and offer from 600px, desktop included', () => {
  it('splits the profile card about 40 / 60, the panes falling back to the phone order below 600px', () => {
    const section = read('components/profile/ProfileSection.tsx')
    expect(section).toContain('flex flex-col fold:grid fold:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] fold:items-start fold:gap-x-6')
    expect(section).toContain('<div className="contents fold:block fold:min-w-0 fold:pe-6 fold:border-e fold:border-slate-100">')
    expect(section).toContain('<SegmentBadge customerType={profile?.customerType} customerTypeOther={profile?.customerTypeOther} />')
    expect(section.indexOf('<SegmentBadge')).toBeLessThan(section.indexOf("t('profile_edit_profile_btn')"))
  })

  it('stacks how to redeem and the purchase row in the offer page’s trailing pane', () => {
    const page = read('app/offers/[offerId]/page.tsx')
    expect(page).not.toContain('fold:max-lg:')
    expect(page).toContain('fold:row-span-3')
    expect(page.match(/fold:col-start-2/g)).toHaveLength(4)
  })

  it('keeps the fixed widgets clear of the side safe areas', () => {
    expect(read('components/layout/WhatsAppWidget.tsx')).toContain('right-[calc(1.25rem+env(safe-area-inset-right,0px))]')
    expect(read('components/layout/CookieNotice.tsx')).toContain('pl-[calc(1.25rem+env(safe-area-inset-left,0px))] pr-[calc(1.25rem+env(safe-area-inset-right,0px))]')
    expect(read('components/perks/SortMenu.tsx')).toContain('pl-[calc(0.75rem+env(safe-area-inset-left,0px))] pr-[calc(0.75rem+env(safe-area-inset-right,0px))]')
  })
})
