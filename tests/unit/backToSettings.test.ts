import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, Lang, TranslationKey } from '@/lib/i18n/translations'
import { settingsBackAction } from '@/lib/navigation/settingsBack'

const nav: { query: string } = { query: '' }

vi.mock('next/navigation', () => ({
  usePathname: () => '/terms',
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  useSearchParams: () => new URLSearchParams(nav.query),
}))

const { default: BackToSettings, fromSettingsHref } = await import('@/components/settings/BackToSettings')

function render(lang: Lang, query: string) {
  nav.query = query
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(
    createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(BackToSettings))
  )
}

describe('Back to Settings on Help & legal pages', () => {
  it('marks the Settings rows’ links', () => {
    expect(fromSettingsHref('/support')).toBe('/support?from=settings')
  })

  it.each(['', 'from=footer', 'utm_source=x'])('stays out of the way when Settings didn’t open the page (%s)', (query) => {
    expect(render('en', query)).toBe('')
  })

  it.each(['en', 'ru', 'es', 'fr', 'he'] as const)('offers a 44px back button with a direction-aware chevron (%s)', (lang) => {
    const html = render(lang, 'from=settings')
    expect(html).toMatch(/^<button type="button" class="[^"]*min-h-\[44px\][^"]*">/)
    expect(html).toContain('class="lucide lucide-chevron-left h-4 w-4 rtl:-scale-x-100"')
    expect(html).toContain(`<span>${translations[lang].settings_back_to_settings}</span>`)
    // Hover only where there's a pointer, so a tap never leaves it tinted.
    expect(html).toContain('[@media(hover:hover)]:hover:text-brand')
    expect(html).not.toMatch(/ hover:/)
  })

  it('goes back through history when Settings is the page below, otherwise replaces this page with /settings', () => {
    expect(settingsBackAction('/settings', '/settings')).toEqual({ kind: 'back' })
    expect(settingsBackAction('/settings', null)).toEqual({ kind: 'replace', href: '/settings' })
    expect(settingsBackAction('/settings', '/')).toEqual({ kind: 'replace', href: '/settings' })
  })
})
