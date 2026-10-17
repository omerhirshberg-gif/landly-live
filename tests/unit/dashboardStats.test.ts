import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, Lang, TranslationKey } from '@/lib/i18n/translations'
import { formatSavings } from '@/lib/format'
import DashboardStats from '@/components/member/DashboardStats'

const LANGS = ['en', 'ru', 'es', 'fr', 'he'] as const

function render(lang: Lang, props: { activePerks?: number; redeemed?: number; saved?: number } = {}) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(
    createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(DashboardStats, props))
  )
}

// Each card: <div shell><i/><div label>…</div><div value>…</div></div>
const cards = (html: string) => [...html.matchAll(/<div class="([^"]*min-h-\[96px\][^"]*)"><i [^>]*><\/i><div class="([^"]*)">([^<]*)<\/div><div class="([^"]*)">([^<]*)<\/div><\/div>/g)]

describe('member dashboard stats', () => {
  it.each(LANGS)('gives all three cards the same shell, label band and bottom-pinned number (%s)', (lang) => {
    const found = cards(render(lang))
    expect(found).toHaveLength(3)
    const t = translations[lang]
    expect(found.map((m) => m[3].replace(/&quot;/g, '"'))).toEqual([t.dash_active_perks_label, t.dash_perks_redeemed_label, t.dash_total_saved])
    for (const [, shell, label, , value] of found) {
      for (const c of ['flex', 'flex-col', 'h-full', 'min-h-[96px]', 'min-w-0']) expect(shell.split(' ')).toContain(c)
      // A two-line band, centred, so one- and two-line labels take the same room.
      for (const c of ['min-h-[36px]', 'flex', 'items-center', 'justify-center']) expect(label.split(' ')).toContain(c)
      // The number anchors to the bottom and never wraps.
      for (const c of ['mt-auto', 'whitespace-nowrap', 'text-base', 'md:text-lg', 'font-bold', 'text-ink']) expect(value.split(' ')).toContain(c)
    }
    // Identical classes on every card, so nothing shifts one of them.
    expect(new Set(found.map((m) => m[1])).size).toBe(1)
    expect(new Set(found.map((m) => m[2])).size).toBe(1)
    expect(new Set(found.map((m) => m[4])).size).toBe(1)
  })

  it('shows the counts and the savings it is given', () => {
    const found = cards(render('en', { activePerks: 3, redeemed: 12, saved: 1250 }))
    expect(found.map((m) => m[5])).toEqual(['3', '12', '₪1,250'])
  })

  it('defaults to zero', () => {
    expect(cards(render('en')).map((m) => m[5])).toEqual(['0', '0', '₪0'])
  })
})

describe('formatSavings', () => {
  it('writes shekels the way each language does, always with ₪', () => {
    expect(formatSavings(1250, 'en')).toBe('₪1,250')
    for (const lang of ['ru', 'es', 'fr', 'he']) {
      const s = formatSavings(1250, lang)
      expect(s).toContain('₪')
      expect(s).not.toContain('ILS')
      // Symbol after the number outside English.
      expect(s.indexOf('₪')).toBeGreaterThan(s.search(/\d/))
    }
  })

  it('never puts a breakable space between the number and ₪', () => {
    for (const lang of LANGS) expect(formatSavings(1250, lang)).not.toMatch(/ /)
  })

  it('drops fractions', () => {
    expect(formatSavings(99.6, 'en')).toBe('₪100')
  })
})
