import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { TERMS_SECTIONS } from '@/lib/legal/termsSections'
import TermsContent from '@/components/legal/TermsContent'

const LANGS = ['en', 'he', 'ru', 'es', 'fr'] as const
const read = (path: string) => readFileSync(`landly-mobile/src/${path}`, 'utf8')

describe('shared terms sections', () => {
  it.each(LANGS)('match the website terms, in order (%s)', (lang: Lang) => {
    const t = (key: TranslationKey) => translations[lang][key]
    const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
    // Email addresses are wrapped in <bdi>; the text around them is unchanged.
    const html = renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(TermsContent))).replace(/<\/?bdi>/g, '')
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
    const keys = TERMS_SECTIONS.flatMap((s) => [s.heading, ...s.body.flat()])
    const positions = keys.map((k) => html.indexOf(esc(t(k))))
    expect(positions.every((i) => i > -1)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })
})

describe('native Help & legal screens', () => {
  it('opens Support, Terms and Privacy as screens in the settings stack, not browser sheets', () => {
    for (const screen of ['support', 'terms', 'privacy']) expect(existsSync(`landly-mobile/src/app/settings/${screen}.tsx`)).toBe(true)
    const index = read('app/settings/index.tsx')
    for (const route of ['/settings/support', '/settings/terms', '/settings/privacy']) expect(index).toContain(`router.push('${route}')`)
    const layout = read('app/settings/_layout.tsx')
    for (const screen of ['support', 'terms', 'privacy']) expect(layout).toContain(`<Stack.Screen name="${screen}" />`)
    for (const file of ['app/settings/index.tsx', 'app/settings/privacy-security.tsx', 'app/settings/support.tsx', 'app/settings/terms.tsx', 'app/settings/privacy.tsx']) {
      expect(read(file), file).not.toMatch(/WebBrowser|openWebPage|openBrowserAsync/)
    }
  })

  it('gives every screen the mirrored back header and the page-flip swipe', () => {
    for (const screen of ['support', 'terms', 'privacy']) expect(read(`app/settings/${screen}.tsx`)).toContain('<ScreenHeader title=')
    const flip = read('lib/pageFlip.ts')
    expect(flip).toContain('gestureEnabled: true')
    expect(flip).toContain('fullScreenGestureEnabled: true')
    expect(flip).toContain('animationMatchesGesture: true')
  })

  it('opens WhatsApp in the app with a wa.me fallback, and email in the mail app', () => {
    const support = read('app/settings/support.tsx')
    expect(support).toContain('whatsapp://send?phone=${SUPPORT_WHATSAPP_NUMBER}&text=${text}')
    expect(support).toContain('${SUPPORT_WHATSAPP_LINK}?text=${text}')
    expect(support).toContain('mailto:${SUPPORT_EMAIL}?subject=')
  })

  it('renders the shared Terms list, with every section the website shows', () => {
    const website = read('../../components/legal/TermsContent.tsx')
    expect(website).toContain("import { TERMS_SECTIONS } from '@/lib/legal/termsSections'")
    expect(website).toContain('TERMS_SECTIONS.map(')
    expect(TERMS_SECTIONS.map((s) => s.heading)).toEqual(['terms_h1', 'terms_h2', 'terms_h3', 'terms_h4', 'terms_h5', 'terms_h6', 'terms_h7', 'terms_h8'])
    expect(TERMS_SECTIONS.find((s) => s.heading === 'terms_h2')?.body).toContainEqual(['terms_p2c_label', 'terms_p2c'])
    const terms = read('app/settings/terms.tsx')
    expect(terms).toContain('TERMS_SECTIONS.map(')
    expect(terms).toContain('isolateEmails(t(key))')
  })

  it('renders the privacy policy in the member\'s language and direction', () => {
    const privacy = read('app/settings/privacy.tsx')
    expect(privacy).toContain('privacyPolicy(lang)')
    expect(privacy).toContain("writingDirection: isRtl ? 'rtl' : 'ltr'")
    expect(privacy).toContain("t('legal_translation_notice')")
    expect(privacy).toContain('isolate(token)')
    expect(privacy).not.toContain("direction: 'ltr'")
    expect(privacy).not.toContain('PRIVACY_POLICY_SECTIONS')
  })

  it('has the new strings in all five languages', () => {
    for (const lang of LANGS) for (const key of ['support_whatsapp_message', 'legal_translation_notice'] as const) expect(translations[lang][key], `${lang}.${key}`).toBeTruthy()
  })
})
