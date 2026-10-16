import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { consentParts } from '@/lib/legal/consentText'
import { CookieNoticeBar } from '@/components/layout/CookieNotice'

const LANGS = Object.keys(translations) as Lang[]

function render(lang: Lang) {
  const t = (key: TranslationKey) => translations[lang][key]
  return renderToStaticMarkup(createElement(CookieNoticeBar, { t, onDismiss: () => {} }))
}

describe('cookie notice copy', () => {
  it.each(LANGS)('has one Privacy Policy link and no third-party promises (%s)', (lang) => {
    const t = translations[lang]
    const parts = consentParts(t.cookie_notice_text)
    expect(parts.filter((p) => 'link' in p)).toEqual([{ link: 'privacy' }])
    expect(t.cookie_notice_text).not.toContain('{terms}')
    expect(t.cookie_notice_privacy_link).toBeTruthy()
    expect(t.cookie_notice_text.toLowerCase()).not.toMatch(/accessib|widget|נגישות|доступност|accesibilidad|accessibilité/)
  })

  it('uses the requested English and Hebrew wording', () => {
    const full = (lang: Lang) =>
      consentParts(translations[lang].cookie_notice_text).map((p) => ('link' in p ? translations[lang].cookie_notice_privacy_link : p.text)).join('')
    expect(full('en')).toBe('We use essential local storage to support your session and language preferences. We do not use advertising or tracking cookies. Learn more in our Privacy Policy.')
    expect(full('he')).toBe('אנו משתמשים באחסון מקומי הכרחי לצורך הפעלת החשבון והעדפות השפה שלך. איננו משתמשים בעוגיות פרסום או מעקב. למידע נוסף עיינו במדיניות הפרטיות.')
  })
})

describe('cookie notice bar', () => {
  it.each(['en', 'he'] as const)('links to /privacy with an underline and hover colour (%s)', (lang) => {
    const html = render(lang)
    const link = html.match(/<a href="\/privacy" class="([^"]*)">([^<]*)<\/a>/)!
    expect(link[2]).toBe(translations[lang].cookie_notice_privacy_link)
    expect(link[1]).toContain('underline')
    expect(link[1]).toContain('hover:text-sky-300')
    expect(link[1]).toContain('transition-colors')
  })

  it('sits under the navbar and drawer and clears the iOS home indicator', () => {
    const html = render('en')
    expect(html).toMatch(/^<div class="fixed bottom-0 inset-x-0 z-\[900\]/)
    expect(html).toContain('padding-bottom:calc(0.875rem + env(safe-area-inset-bottom, 0px))')
  })

  it('stacks on phones with a centred dismiss button, and goes to one row from 640px', () => {
    const html = render('en')
    expect(html).toContain('flex flex-col items-stretch gap-3 sm:flex-row sm:items-center')
    expect(html).toMatch(/<div class="flex items-center justify-center gap-2 flex-shrink-0"><button[^>]*>Got it<\/button>/)
    expect(html).toMatch(/aria-label="Dismiss this notice" class="hidden sm:inline-flex/)
    // Logical alignment, so Hebrew starts on the right.
    expect(html).toContain('text-center sm:text-start')
  })
})
