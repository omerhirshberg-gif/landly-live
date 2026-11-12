import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { placePanel } from '@/components/layout/AnchoredPanel'
import { translations } from '@/lib/i18n/translations'

const read = (p: string) => readFileSync(p, 'utf8')
const VIEW = { width: 1440, height: 900 }

describe('placePanel (the navbar dropdowns\' position)', () => {
  it('puts the panel under the anchor with its end edge on the anchor\'s, in whole pixels', () => {
    const p = placePanel({ top: 12.4, bottom: 52.6, left: 1100.3, right: 1140.7 }, VIEW, { width: 380, maxHeight: 480 }, false)
    expect(p).toEqual({ top: 61, left: 761, width: 380, maxHeight: 480 })
    for (const n of Object.values(p)) expect(Number.isInteger(n)).toBe(true)
  })
  it('never leaves the viewport: clamps to 8px at either edge, and narrows on a phone', () => {
    expect(placePanel({ top: 0, bottom: 40, left: 0, right: 30 }, VIEW, { width: 380, maxHeight: 480 }, false).left).toBe(8)
    expect(placePanel({ top: 0, bottom: 40, left: 1430, right: 1470 }, VIEW, { width: 380, maxHeight: 480 }, false).left).toBe(1440 - 380 - 8)
    const phone = placePanel({ top: 0, bottom: 64, left: 300, right: 340 }, { width: 360, height: 640 }, { width: 380, maxHeight: 480 }, false)
    expect(phone.width).toBe(344)
    expect(phone.left).toBe(8)
  })
  it('keeps the panel inside a short viewport', () => {
    expect(placePanel({ top: 0, bottom: 64, left: 800, right: 840 }, { width: 1200, height: 400 }, { width: 380, maxHeight: 480 }, false).maxHeight).toBe(320)
  })
})

describe('navbar panels render crisp', () => {
  const panel = read('components/layout/AnchoredPanel.tsx')
  it('portals to <body> with no scale or fractional translate', () => {
    expect(panel).toContain('createPortal(')
    expect(panel).toContain('document.body')
    expect(panel).toContain('Math.round')
    expect(panel).toContain('antialiased')
    expect(panel).toContain('border-[#E2E8F0]')
    expect(panel).toContain('shadow-[0_12px_32px_-8px_rgba(11,27,61,0.12)]')
    expect(panel.replace(/^\s*\/\/.*$/gm, '')).not.toMatch(/scale-|scale\(|translate/)
    const css = read('app/globals.css')
    expect(css).toMatch(/@keyframes landly-panel-in\{from\{opacity:0;\}\}/)
    expect(css).not.toMatch(/\.account-(menu|item|divider|badge)/)
  })
  it('closes on an outside press and on Escape, returning focus on Escape', () => {
    expect(panel).toContain("'pointerdown'")
    expect(panel).toContain("event.key === 'Escape'")
    expect(panel).toContain('onClose(true)')
  })
})

describe('WishlistPopover', () => {
  const src = read('components/layout/WishlistPopover.tsx')
  it('is a popover from 1024px and a bottom sheet below it', () => {
    expect(src).toContain("'(max-width: 1023px)'")
    expect(src).toContain('width={380} maxHeight={480}')
    expect(src).toContain('perks-sheet')
    expect(src).toContain('useBodyScrollLock(open && isSheet)')
  })
  it('shows the badge only when something is saved, in an LTR island, capped at 99+', () => {
    expect(src).toContain('wishlistCount > 0 &&')
    expect(src).toMatch(/<bdi dir="ltr" className="tabular-nums">\{wishlistBadgeLabel\(wishlistCount\)\}<\/bdi>/)
  })
  it('rows link to the offer and close, show discounted and struck original prices in LTR islands, and can be removed', () => {
    expect(src).toContain('href={`/offers/${offer.id}`} onClick={onNavigate}')
    expect(src).toMatch(/<bdi dir="ltr" className="text-sm font-bold tabular-nums text-brand">\{formatPrice\(offer\.offerPrice\)\}/)
    expect(src).toMatch(/text-xs tabular-nums text-slate-400 line-through/)
    expect(src).toContain('h-12 w-12 flex-shrink-0')
    expect(src).toContain('toggleWishlist(offer.id)')
  })
  it('has an empty state that links to /categories', () => {
    expect(src).toContain('wishlist_empty_title')
    expect(src).toContain('href="/categories"')
  })
  it('is labelled in every language', async () => {
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) {
      for (const key of ['wishlist_popover_title', 'wishlist_popover_remove', 'wishlist_popover_browse'] as const) expect(translations[lang][key], `${lang} ${key}`).toBeTruthy()
    }
  })
})

describe('AccountMenu', () => {
  const src = read('components/layout/AccountMenu.tsx')
  it('uses the portal panel, a 36px ringed avatar, the real segment badge and an LTR email', () => {
    expect(src).toContain('<AnchoredPanel')
    expect(src).toContain('size={36} className="ring-1 ring-slate-200"')
    expect(src).toContain('<SegmentBadge customerType={profile?.customerType}')
    expect(src).toMatch(/<bdi dir="ltr">\{user\.email\}<\/bdi>/)
    expect(src).toContain('font-display text-sm font-bold leading-snug text-ink')
  })
  it('has 18px 1.75-stroke icons, a hairline above a rose Sign Out, and no mirrored icon', () => {
    expect(src).toContain('h-[18px] w-[18px]')
    expect(src).toContain('strokeWidth={1.75}')
    expect(src).toContain('border-t border-slate-200/80')
    expect(src).toContain('text-rose-600')
    expect(src).not.toMatch(/scale-x|-scale/)
  })
})
