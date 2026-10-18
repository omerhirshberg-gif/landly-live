import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { backAction } from '@/lib/navigation/back'

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }) }))
import BackButton from '@/components/navigation/BackButton'

function render(lang: Lang, props: Parameters<typeof BackButton>[0]) {
  const dict = translations[lang] as Record<string, string>
  const t = (key: TranslationKey) => dict[key] ?? key
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(BackButton, props)))
}

describe('backAction', () => {
  it('steps back through history when an in-app page is behind', () => {
    expect(backAction('/categories', '/')).toEqual({ kind: 'back' })
    expect(backAction('/offers/a', '/offers/a')).toEqual({ kind: 'back' })
  })
  it('replaces with the fallback when the page was opened directly', () => {
    expect(backAction('/categories', null)).toEqual({ kind: 'replace', href: '/categories' })
  })
  it('always uses the fallback when forced', () => {
    expect(backAction('/member', '/checkout', true)).toEqual({ kind: 'replace', href: '/member' })
  })
})

describe('BackButton', () => {
  it('is a 48px button whose arrow flips in RTL', () => {
    const html = render('en', { fallback: '/categories' })
    expect(html).toMatch(/^<button type="button"/)
    expect(html).toContain('min-h-12')
    expect(html).toContain('rtl:-scale-x-100')
    expect(html).toContain('focus-visible:ring-2')
    expect(html).toContain('>Back<')
  })
  it('names the icon variant for screen readers, in Hebrew too', () => {
    const html = render('he', { fallback: '/', variant: 'icon' })
    expect(html).toContain('aria-label="חזרה"')
    expect(html).toContain('h-12 w-12')
  })
  it('guards hover behind (hover:hover)', () => {
    expect(render('en', { fallback: '/' })).not.toMatch(/(^|\s)hover:/)
  })
})

describe('native edge swipes stay with the browser', () => {
  const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
  it('never blocks touch gestures or sideways overscroll on the page', () => {
    expect(css).not.toMatch(/(html|body)[^{]*\{[^}]*touch-action\s*:\s*none/)
    expect(css).not.toMatch(/(html|body)[^{]*\{[^}]*overscroll-behavior(-x)?\s*:\s*(none|contain)/)
    expect(css).toContain('html,body{overscroll-behavior-x:auto;}')
  })
})
