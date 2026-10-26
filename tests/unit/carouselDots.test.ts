import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { snapIndex } from '@/lib/useSnapIndex'

const { default: ValueProps } = await import('@/components/home/ValueProps')

function withLang(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

describe('snap index', () => {
  // A 375px row of 180px cards 12px apart (What's inside on a phone): its visible centre is at 187.5.
  const row = { clientWidth: 375, scrollWidth: 20 + 4 * 180 + 3 * 12 + 20, viewCentre: 187.5 }

  it('counts the card centred in the row, not the first of two that both show whole', () => {
    // Card 2 centred: cards 1 and 3 half show, and card 2 is nearest the middle.
    expect(snapIndex({ ...row, scrolled: 206, itemCentres: [-96, 96, 288, 480] })).toBe(1)
    expect(snapIndex({ ...row, scrolled: 398, itemCentres: [-288, -96, 96, 288] })).toBe(2)
  })

  it('reads the same in Hebrew, where the row runs right to left and scrollLeft counts negative', () => {
    // The same positions mirrored: the first card on the right. `scrolled` is the absolute scrollLeft.
    expect(snapIndex({ ...row, scrolled: 206, itemCentres: [471, 279, 87, -105] })).toBe(1)
    expect(snapIndex({ ...row, scrolled: 398, itemCentres: [663, 471, 279, 87] })).toBe(2)
  })

  it('lights the last dot at the end of the row and the first at its start, though neither card is centred', () => {
    const end = row.scrollWidth - row.clientWidth
    expect(snapIndex({ ...row, scrolled: end, itemCentres: [-275, -83, 109, 301] })).toBe(3)
    expect(snapIndex({ ...row, scrolled: end - 0.5, itemCentres: [-275, -83, 109, 301] })).toBe(3)
    expect(snapIndex({ ...row, scrolled: 0, itemCentres: [110, 302, 494, 686] })).toBe(0)
  })

  it('is the first card when the row does not scroll, and none for an empty row', () => {
    expect(snapIndex({ clientWidth: 900, scrollWidth: 900, viewCentre: 450, scrolled: 0, itemCentres: [100, 400, 700] })).toBe(0)
    expect(snapIndex({ ...row, scrolled: 0, itemCentres: [] })).toBe(-1)
  })

  it('measures once a frame while the row scrolls, and scrolls a card in without moving the page', () => {
    const hook = readFileSync('lib/useSnapIndex.ts', 'utf8')
    expect(hook).toContain("row.addEventListener('scroll', schedule, { passive: true })")
    expect(hook).toContain('requestAnimationFrame(measure)')
    expect(hook).toContain('Math.abs(row.scrollLeft)')
    expect(hook).toContain("inline: 'center', block: 'nearest'")
    expect(hook).toContain("behavior: reduced ? 'auto' : 'smooth'")
  })
})

describe("what's inside dots", () => {
  it.each(Object.keys(translations) as Lang[])('has one labelled dot per card, the first active as a pill, phones only (%s)', (lang) => {
    const t = translations[lang]
    const html = withLang(lang, createElement(ValueProps))
    const dots = html.slice(html.indexOf('<div class="flex justify-center sm:hidden">'))
    const buttons = dots.match(/<button type="button"[^>]*>/g) ?? []
    expect(buttons).toHaveLength(4)
    for (let i = 0; i < 4; i++) expect(buttons[i]).toContain(`aria-label="${t.landing_dots_label.replace('{n}', String(i + 1)).replace('{total}', '4')}"`)
    expect(buttons[0]).toContain('aria-current="true"')
    for (const b of buttons.slice(1)) expect(b).not.toContain('aria-current')
    expect(dots).toContain('w-6 bg-brand')
    expect(dots.match(/w-1\.5 bg-slate-300/g)).toHaveLength(3)
    expect(dots).toContain('motion-reduce:transition-none')
  })

  it('keeps the swipe row as it was: snap to centre, no arrow buttons', () => {
    const html = withLang('en', createElement(ValueProps))
    expect(html).toMatch(/<ul class="[^"]*overflow-x-auto[^"]*snap-x snap-mandatory/)
    expect(html).not.toMatch(/fa-chevron|fa-angle|rail-arrow/)
  })
})

describe('how it works carousel', () => {
  it.each(['en', 'he'] as const)('swipes on phones (steps and the /olim card), with a dot per slide, and is a three-column grid from md (%s)', async (lang) => {
    const { default: HowItWorks } = await import('@/components/home/HowItWorks')
    const t = translations[lang]
    const html = withLang(lang, createElement(HowItWorks))
    expect(html).toMatch(/<div class="[^"]*flex gap-4 overflow-x-auto[^"]*snap-x snap-mandatory[^"]*\[-webkit-overflow-scrolling:touch\][^"]*md:grid md:grid-cols-3[^"]*md:overflow-visible">/)
    expect(html.match(/min-w-\[82vw\] max-w-\[340px\] sm:min-w-\[320px\] flex-shrink-0 snap-center md:min-w-0 md:max-w-none/g)).toHaveLength(4)
    // The /olim card spans the grid from md, as a banner under the steps.
    expect(html).toMatch(/<a class="[^"]*md:col-span-3[^"]*" href="\/olim">/)
    const dots = html.slice(html.indexOf('<div class="flex justify-center md:hidden">'))
    const buttons = dots.match(/<button type="button"[^>]*>/g) ?? []
    expect(buttons).toHaveLength(4)
    expect(buttons[0]).toContain(`aria-label="${t.landing_dots_label.replace('{n}', '1').replace('{total}', '4')}"`)
    expect(buttons[0]).toContain('aria-current="true"')
    // 44px tap targets; icons, not emoji.
    for (const b of buttons) expect(b).toContain('h-11 w-11')
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u)
    for (const icon of ['lucide-user-plus', 'lucide-sparkles', 'lucide-qr-code', 'lucide-plane-takeoff']) expect(html).toContain(icon)
    expect(html).not.toContain('fa-solid')
  })
})

describe('rail pagination dots', () => {
  it('stops at eight: past that a row of dots is noise, on the web and in the app', async () => {
    const { SNAP_DOTS_MAX } = await import('@/components/ui/SnapDots')
    const { PAGER_DOTS_MAX } = await import('../../landly-mobile/src/lib/carousel')
    expect(SNAP_DOTS_MAX).toBe(8)
    expect(PAGER_DOTS_MAX).toBe(SNAP_DOTS_MAX)
    for (const path of ['components/discover/OfferTileRail.tsx', 'components/home/CuratedOffers.tsx']) {
      const source = readFileSync(path, 'utf8')
      expect(source, path).toContain('.length > 1 && ')
      expect(source, path).toContain('.length <= SNAP_DOTS_MAX && <SnapDots')
      expect(source, path).toContain('sm:hidden')
    }
  })

  it('places the Expo carousel between its resting offsets, one dot per place a swipe can stop', async () => {
    const { carouselPage, carouselSnapOffsets } = await import('../../landly-mobile/src/lib/carousel')
    // Five 260pt cards, 272pt apart, in a row that can scroll 900pt: the last two share the end.
    const starts = carouselSnapOffsets(5, 272, 900, false)
    expect(starts).toEqual([0, 272, 544, 816, 900])
    expect(carouselPage(0, starts)).toBe(0)
    expect(carouselPage(136, starts)).toBe(0.5)
    expect(carouselPage(544, starts)).toBe(2)
    expect(carouselPage(858, starts)).toBe(3.5)
    expect(carouselPage(900, starts)).toBe(4)
    // Overscroll at either end holds the first or last dot.
    expect(carouselPage(-40, starts)).toBe(0)
    expect(carouselPage(960, starts)).toBe(4)
    expect(carouselPage(120, [0])).toBe(0)
  })
})
