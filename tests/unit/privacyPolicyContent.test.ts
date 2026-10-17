import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PrivacyPolicy, { PRIVACY_POLICY_UPDATED } from '@/components/legal/PrivacyPolicy'
import {
  PRIVACY_POLICY_INTRO,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_TITLE,
  PRIVACY_POLICY_UPDATED_LABEL,
  blockTexts,
  inlineText,
} from '@/lib/legal/privacyPolicyContent'

// The app's native Privacy Policy screen renders lib/legal/privacyPolicyContent.ts;
// the website renders components/legal/PrivacyPolicy.tsx. Every block of the
// shared data must appear, word for word, in the website's policy.
const normalize = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim()

const web = normalize(renderToStaticMarkup(createElement(PrivacyPolicy)))

describe('shared privacy policy content', () => {
  it('has the same title, date, sections and order as the website', () => {
    expect(PRIVACY_POLICY_UPDATED_LABEL).toBe(PRIVACY_POLICY_UPDATED.label)
    expect(web).toContain(PRIVACY_POLICY_TITLE)
    const webSections = [...renderToStaticMarkup(createElement(PrivacyPolicy)).matchAll(/<section id="([^"]+)"/g)].map((m) => m[1])
    expect(PRIVACY_POLICY_SECTIONS.map((s) => s.id)).toEqual(webSections)
    PRIVACY_POLICY_SECTIONS.forEach((s, i) => expect(web).toContain(`${i + 1}. ${s.title}`))
  })

  it('matches the website word for word, block by block', () => {
    expect(web).toContain(normalize(PRIVACY_POLICY_INTRO.map(inlineText).join('')))
    for (const section of PRIVACY_POLICY_SECTIONS) {
      for (const block of section.blocks) {
        for (const text of blockTexts(block)) expect(web, `${section.id}: ${text.slice(0, 60)}`).toContain(normalize(text))
      }
    }
  })

  it('links only to real sections or web pages', () => {
    const ids = new Set(PRIVACY_POLICY_SECTIONS.map((s) => s.id))
    for (const section of PRIVACY_POLICY_SECTIONS) {
      for (const block of section.blocks) {
        const runs = block.kind === 'p' || block.kind === 'callout' ? block.text : block.kind === 'ul' || block.kind === 'ol' ? block.items.flat() : block.kind === 'address' ? block.lines.flat() : []
        for (const run of runs) {
          if (typeof run === 'object' && 'href' in run) {
            if (run.href.startsWith('#')) expect(ids.has(run.href.slice(1)), run.href).toBe(true)
            else expect(run.href).toMatch(/^https:\/\//)
          }
        }
      }
    }
  })
})

describe('privacy policy reflects what the product does today', () => {
  const shared = normalize(
    PRIVACY_POLICY_SECTIONS.flatMap((s) => s.blocks.flatMap(blockTexts)).join(' ')
  )

  it.each([
    ['web', web],
    ['app', shared],
  ])('%s: offers the in-app deletion request alongside email', (_, text) => {
    expect(text).toContain('Settings → Delete Account (or via the website settings), or by contacting our team at team.landly@gmail.com.')
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
