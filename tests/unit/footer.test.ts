import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, Lang, TranslationKey } from '@/lib/i18n/translations'

const { default: Footer } = await import('@/components/layout/Footer')

function render(lang: Lang) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(
    createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(Footer))
  )
}

const LANGS = ['en', 'ru', 'es', 'fr', 'he'] as const

describe('footer', () => {
  it.each(LANGS)('names the company plainly as Landly, never Ltd. (%s)', (lang) => {
    const html = render(lang)
    expect(html).not.toMatch(/Ltd|בע"מ|בע״מ/)
    expect(html).toContain(`© ${new Date().getFullYear()} <bdi>Landly</bdi>. ${translations[lang].footer_copyright_notice}`)
  })

  it.each(LANGS)('links only what the navbar does not — FAQ, legal and the business portal (%s)', (lang) => {
    const html = render(lang)
    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]).filter((h) => !h.startsWith('http'))
    expect(hrefs).toEqual(['/support#faq', '/terms', '/privacy', '/business/login', 'mailto:team.landly@gmail.com'])
    expect(html).toContain(translations[lang].footer_biz_login)
  })

  it.each(LANGS)('puts a quiet dot between links only, never before the first or after the last (%s)', (lang) => {
    const nav = render(lang).match(/<nav aria-label="Footer"[\s\S]*?<\/nav>/)![0]
    const dot = '<span class="text-slate-300 select-none mx-2 sm:mx-3" aria-hidden="true">·</span>'
    expect(nav.split(dot).length - 1).toBe(3)
    expect(nav).toMatch(/^<nav[^>]*><span[^>]*><a /)
    expect(nav).toMatch(/<\/a><\/span><\/nav>$/)
  })

  it('gives the business portal link its own icon and weight', () => {
    expect(render('en')).toMatch(/<a class="[^"]*text-slate-700 font-semibold[^"]*" href="\/business\/login"><i class="fa-solid fa-store/)
  })

  it('shows the contact email and location exactly once', () => {
    const html = render('en')
    expect(html.split('team.landly@gmail.com').length - 1).toBe(2) // href + label
    expect(html.split(translations.en.footer_location).length - 1).toBe(1)
  })

  it('uses the light theme, not the old dark block', () => {
    const html = render('he')
    expect(html).toContain('bg-[#F8FAFC]')
    expect(html).toContain('border-[#E2E8F0]')
    expect(html).not.toContain('bg-slate-900')
    expect(html).not.toMatch(/\b(ml|mr|pl|pr|left|right)-\d/)
  })
})
