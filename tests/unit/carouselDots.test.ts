import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { mostVisibleIndex } from '@/lib/useSnapIndex'

const { default: ValueProps } = await import('@/components/home/ValueProps')

function withLang(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

describe('snap index', () => {
  it('picks the most visible card, and none when nothing shows', () => {
    expect(mostVisibleIndex([0.2, 0.9, 0.4, 0])).toBe(1)
    expect(mostVisibleIndex([1, 1, 0, 0])).toBe(0)
    expect(mostVisibleIndex([0, 0, 0.1, 0.6])).toBe(3)
    expect(mostVisibleIndex([0, 0, 0, 0])).toBe(-1)
    expect(mostVisibleIndex([])).toBe(-1)
  })

  it('observes the row itself, never scroll events, and scrolls a card in without moving the page', () => {
    const hook = readFileSync('lib/useSnapIndex.ts', 'utf8')
    expect(hook).toContain('new IntersectionObserver(')
    expect(hook).toContain('{ root: row,')
    expect(hook).not.toContain("addEventListener('scroll'")
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
    for (const icon of ['fa-user-plus', 'fa-ticket', 'fa-bullseye', 'fa-plane-departure']) expect(html).toContain(icon)
  })
})
