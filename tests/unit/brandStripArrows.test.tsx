import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { translations } from '@/lib/i18n/translations'
import { railState, railStep } from '@/lib/offers/railScroll'
import BrandStrip from '@/components/offers/BrandStrip'
import RailArrows from '@/components/offers/RailArrows'

let lang: 'en' | 'he' = 'en'
vi.mock('@/lib/i18n/useLang', () => ({ useLang: () => ({ lang, isRtl: lang === 'he', t: (key: string) => (translations[lang] as Record<string, string>)[key] ?? key }) }))
vi.mock('@/lib/useBodyScrollLock', () => ({ useBodyScrollLock: () => undefined }))

const entries = Array.from({ length: 231 }, (_, i) => ({ offerId: `o${i}`, name: `Brand ${i}`, logoUrl: '', branchCount: i % 3 }))

describe('rail scroll maths', () => {
  const m = { clientWidth: 400, scrollWidth: 2000 }
  it('LTR: at rest the start is reached and next pages forward', () => {
    expect(railState({ ...m, scrollLeft: 0 })).toEqual({ atStart: true, atEnd: false })
    expect(railStep({ ...m, scrollLeft: 0 }, false, 'next')).toBe(340)
    expect(railStep({ ...m, scrollLeft: 0 }, false, 'prev')).toBe(-340)
  })
  it('RTL: scrollLeft runs negative, next pages toward negative', () => {
    expect(railState({ ...m, scrollLeft: -300 })).toEqual({ atStart: false, atEnd: false })
    expect(railStep({ ...m, scrollLeft: 0 }, true, 'next')).toBe(-340)
    expect(railStep({ ...m, scrollLeft: -300 }, true, 'prev')).toBe(340)
  })
  it('detects the end in both directions', () => {
    expect(railState({ ...m, scrollLeft: 1600 }).atEnd).toBe(true)
    expect(railState({ ...m, scrollLeft: -1600 }).atEnd).toBe(true)
  })
})

describe('BrandStrip', () => {
  const html = (l: 'en' | 'he') => { lang = l; return renderToStaticMarkup(createElement(BrandStrip, { entries })) }
  it('puts the arrows in the header row (36px, hover pointers from lg), never over the cards, the leading one disabled at the start', () => {
    lang = 'en'
    const out = renderToStaticMarkup(createElement(RailArrows, { edge: { atStart: true, atEnd: false, overflow: true }, page: () => undefined }))
    expect(out).toContain('data-rail-arrow="prev"')
    expect(out).toContain('data-rail-arrow="next"')
    expect(out).toContain('h-9 w-9')
    expect(out).toContain('border-[#E2E8F0]')
    expect(out).toContain('[@media(hover:hover)]:lg:flex')
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*data-rail-arrow="prev"|<button[^>]*data-rail-arrow="prev"[^>]*disabled=""/)
    expect(out).not.toContain('absolute')
    expect(renderToStaticMarkup(createElement(RailArrows, { edge: { atStart: true, atEnd: false, overflow: false }, page: () => undefined }))).toBe('')
    for (const f of ['components/offers/BrandStrip.tsx', 'components/offers/BranchStrip.tsx']) {
      const src = readFileSync(f, 'utf8')
      expect(src).toContain('<RailArrows')
      expect(src).not.toContain('data-rail-arrow')
    }
  })
  it('swaps the chevrons in Hebrew', () => {
    lang = 'he'
    const he = renderToStaticMarkup(createElement(RailArrows, { edge: { atStart: false, atEnd: false, overflow: true }, page: () => undefined }))
    expect(he).toContain('aria-label="גלילה לרשתות הקודמות"')
    expect(he.indexOf('lucide-chevron-right')).toBeLessThan(he.indexOf('lucide-chevron-left'))
    lang = 'en'
    const en = renderToStaticMarkup(createElement(RailArrows, { edge: { atStart: false, atEnd: false, overflow: true }, page: () => undefined }))
    expect(en.indexOf('lucide-chevron-left')).toBeLessThan(en.indexOf('lucide-chevron-right'))
  })
  it('widens the branch cards and keeps the scroll padding', () => {
    const src = readFileSync('components/offers/BranchStrip.tsx', 'utf8')
    expect(src).toContain('w-[248px] min-w-[200px]')
    expect(src).toContain('scroll-px-1')
  })
  it('shows the count in a header link and the full-width button, isolated for RTL', () => {
    const en = html('en')
    expect(en).toContain('Show all (⁦231⁩)')
    expect(en).toContain('Show all ⁦231⁩ chains')
    expect(en).toContain('min-h-[44px] w-full rounded-xl border border-[#0038B8]/25 bg-[#F0F7FF]')
    const he = html('he')
    expect(he).toContain('הצג הכל (⁦231⁩)')
    expect(he).toContain('הצג את כל ⁦231⁩ הרשתות')
  })
  it('opens a searchable grid of every brand (modal source)', () => {
    const src = readFileSync('components/offers/BrandStrip.tsx', 'utf8')
    expect(src).toContain('data-all-brands-grid')
    expect(src).toContain('grid grid-cols-2 gap-3')
    expect(src).toContain('backdrop')
    expect(src).not.toContain('slice(0, 40)}\n          </ul>\n        )}\n      </div>\n    </div>')
  })
  it('has the new strings in all five languages', () => {
    for (const l of ['en', 'he', 'ru', 'fr', 'es'] as const) for (const k of ['brands_show_all', 'brands_show_all_cta', 'brands_scroll_prev', 'brands_scroll_next']) expect((translations[l] as Record<string, string>)[k]).toBeTruthy()
  })
  it('native sheet is a two-column grid with the same copy', () => {
    const src = readFileSync('landly-mobile/src/components/BrandStrip.tsx', 'utf8')
    expect(src).toContain('numColumns={2}')
    expect(src).toContain("brands_show_all_cta")
    expect(src).toContain('blurRadius={24}')
  })
})
