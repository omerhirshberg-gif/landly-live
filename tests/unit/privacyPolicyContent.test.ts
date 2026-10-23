import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PrivacyPolicy, { PRIVACY_POLICY_UPDATED } from '@/components/legal/PrivacyPolicy'
import { translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import {
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_STRUCTURE,
  PRIVACY_POLICY_TITLE,
  PRIVACY_POLICY_UPDATED_LABEL,
  blockTexts,
  inlineText,
  parseInline,
  privacyPolicy,
} from '@/lib/legal/privacyPolicyContent'

// The app's native Privacy Policy screen and the website both render
// privacyPolicy(lang) from lib/legal/privacyPolicyContent.ts. Every block of
// the shared data must appear, word for word and in order, in the website's
// policy, in every language; and every translation must keep the English
// version's links, code and contact placeholders.
const LANGS: Lang[] = ['en', 'he', 'ru', 'es', 'fr']

// Plain text: spacing and punctuation the HTML puts around inline elements.
const clean = (s: string) =>
  s
    .replace(/[\u2068\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim()
// Rendered HTML: tags out first, then entities (so `<uid>` in code survives).
// Inline elements add no space of their own, as in the browser.
const normalize = (html: string) =>
  clean(
    html
      .replace(/<\/?(?:strong|code|a|bdi|time)\b[^>]*>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
  )

const renderIn = (lang: Lang) => renderToStaticMarkup(createElement(PrivacyPolicy, { lang }))
const web = normalize(renderToStaticMarkup(createElement(PrivacyPolicy)))

describe('shared privacy policy content', () => {
  it('has the same title, date, sections and order as the website', () => {
    expect(PRIVACY_POLICY_UPDATED_LABEL).toBe(PRIVACY_POLICY_UPDATED.label)
    expect(web).toContain(PRIVACY_POLICY_TITLE)
    const webSections = [...renderToStaticMarkup(createElement(PrivacyPolicy)).matchAll(/<section id="([^"]+)"/g)].map((m) => m[1])
    expect(PRIVACY_POLICY_SECTIONS.map((s) => s.id)).toEqual(webSections)
    PRIVACY_POLICY_SECTIONS.forEach((s, i) => expect(web).toContain(`${i + 1}. ${s.title}`))
  })

  it.each(LANGS)('matches the website word for word, block by block, in order (%s)', (lang) => {
    const html = renderIn(lang)
    const page = normalize(html)
    const policy = privacyPolicy(lang)
    expect([...html.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1])).toEqual(PRIVACY_POLICY_STRUCTURE.map((s) => s.id))
    expect(page).toContain(clean(`${policy.updatedLabel} ${policy.updatedDate}`))
    let cursor = page.indexOf(clean(policy.intro.map(inlineText).join('')))
    expect(cursor, 'intro').toBeGreaterThan(-1)
    policy.sections.forEach((section, i) => {
      const heading = page.indexOf(`${i + 1}. ${section.title}`, cursor)
      expect(heading, `${lang} ${section.id} heading`).toBeGreaterThan(cursor)
      cursor = heading
      for (const block of section.blocks) {
        for (const text of blockTexts(block)) {
          const at = page.indexOf(clean(text), cursor)
          expect(at, `${lang} ${section.id}: ${text.slice(0, 60)}`).toBeGreaterThanOrEqual(cursor)
          cursor = at
        }
      }
    })
  })

  it.each(LANGS)('links only to real sections, web pages or the support phone line (%s)', (lang) => {
    const { sections } = privacyPolicy(lang)
    const ids = new Set(sections.map((s) => s.id))
    for (const section of sections) {
      for (const block of section.blocks) {
        const runs = block.kind === 'p' || block.kind === 'callout' ? block.text : block.kind === 'ul' || block.kind === 'ol' ? block.items.flat() : block.kind === 'address' ? block.lines.flat() : []
        for (const run of runs) {
          if (typeof run === 'object' && 'href' in run) {
            if (run.href.startsWith('#')) expect(ids.has(run.href.slice(1)), run.href).toBe(true)
            else expect(run.href).toMatch(/^(https:\/\/|tel:\+\d+$)/)
          }
        }
      }
    }
  })

  it.each(LANGS.filter((l) => l !== 'en'))('keeps every link, code token and placeholder of the English text (%s)', (lang) => {
    const tokens = (key: TranslationKey, l: Lang) => {
      const s = translations[l][key]
      return [...s.matchAll(/`[^`]+`|\]\([^)]+\)|\{\w+\}|\*\*/g)].map((m) => m[0]).filter((t) => t !== '**').sort()
    }
    const keys = PRIVACY_POLICY_STRUCTURE.flatMap((s) => [s.title, ...s.blocks.flatMap((b) => ('key' in b ? [b.key] : b.keys))])
    for (const key of keys) {
      expect(tokens(key, lang), `${lang}.${key}`).toEqual(tokens(key, 'en'))
      expect((translations[lang][key].match(/\*\*/g) ?? []).length % 2, `${lang}.${key} bold markers`).toBe(0)
    }
  })

  it('parses the inline markup', () => {
    expect(parseInline('a **b** `c` [d](#e) {email} f')).toEqual(['a ', { bold: 'b' }, ' ', { code: 'c' }, ' ', { link: 'd', href: '#e' }, ' ', { email: true }, ' f'])
  })
})

describe('privacy policy reflects what the product does today', () => {
  const shared = clean(PRIVACY_POLICY_SECTIONS.flatMap((s) => s.blocks.flatMap(blockTexts)).join(' '))

  it.each([
    ['web', web],
    ['app', shared],
  ])('%s: offers the in-app deletion request alongside email', (_, text) => {
    expect(text).toContain(
      'Settings → Delete Account (or via the website settings at www.golandly.com/settings/delete-account), or by contacting our team at contact@golandly.com.'
    )
    expect(text).not.toMatch(/coming soon/i)
    expect(text).not.toContain('until then, email is the way to request deletion')
  })

  it.each([
    ['web', web],
    ['app', shared],
  ])('%s: calls the member page Profile and lists origin and region', (_, text) => {
    expect(text).toContain('your Profile page')
    expect(text).not.toMatch(/account page/i)
    expect(text).toContain('Your country of origin')
    expect(text).toContain(
      'Where in Israel you live, if you choose to tell us: one of North, Haifa & Krayot, Center, Tel Aviv & Gush Dan, Jerusalem or South, or that you are not in Israel yet.'
    )
  })
})

describe('privacy policy covers marketing emails', () => {
  const shared = clean(PRIVACY_POLICY_SECTIONS.flatMap((s) => s.blocks.flatMap(blockTexts)).join(' '))

  it.each([
    ['web', web],
    ['app', shared],
  ])('%s: names Responder and the one-click unsubscribe, which spares transactional email', (_, text) => {
    expect(text).toContain('Responder (Rav-Masar): delivery of our marketing emails and newsletters to members who opted in.')
    expect(text).toContain('Responder receives only your email address, name and preferred language')
    expect(text).toContain('clicking the "Unsubscribe" link at the bottom of any marketing email')
    expect(text).toContain('Unsubscribing does not affect transactional emails')
    expect(text).toContain('email verification, password resets and voucher or order confirmations')
    expect(text).toContain('Marketing emails: updates on exclusive perks, new partners and community news, only if you opted in (consent).')
  })

  it.each([
    ['web', web],
    ['app', shared],
  ])('%s: points every email contact at contact@golandly.com', (_, text) => {
    const addresses = new Set(text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g))
    expect([...addresses]).toEqual(['contact@golandly.com'])
  })
})
