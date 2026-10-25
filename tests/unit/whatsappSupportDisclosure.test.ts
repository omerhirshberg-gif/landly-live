import { describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { translations, type Lang } from '@/lib/i18n/translations'

vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => ({}) }))

import { SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_LINK, SUPPORT_WHATSAPP_NUMBER } from '@/lib/config'
import PrivacyPolicy from '@/components/legal/PrivacyPolicy'
import { MESSAGE_TTL_MS } from '@/lib/whatsapp/conversationLog'

const LANGS: Lang[] = ['en', 'he', 'ru', 'es', 'fr']
const DAY_MS = 24 * 60 * 60 * 1000

// Rendered text with tags stripped and entities decoded, so sentences read as one string.
const text = (html: string) =>
  html.replace(/<[^>]+>/g, '').replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ')

describe('one WhatsApp support number', () => {
  it('derives the wa.me link from the number', () => {
    expect(SUPPORT_WHATSAPP_NUMBER).toBe('972552889033')
    expect(SUPPORT_WHATSAPP_DISPLAY).toBe('+972 55-288-9033')
    expect(SUPPORT_WHATSAPP_LINK).toBe('https://wa.me/972552889033')
  })

  it('leaves no retired number in the source', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name.startsWith('.')) continue
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.(tsx?|mjs|json|md)$/.test(name)) files.push(path)
      }
    }
    for (const dir of ['app', 'components', 'lib', 'docs', 'scripts', 'landly-mobile/src']) walk(dir)
    for (const file of files) expect(readFileSync(file, 'utf8'), file).not.toMatch(/557206711|55-720-6711|557121438|55-712-1438/)
  })

  it('isolates the number left-to-right on the business support page', () => {
    const page = readFileSync('app/business/dashboard/support/page.tsx', 'utf8')
    expect(page).toMatch(/<bdi dir="ltr">\s*<a\s+href=\{SUPPORT_WHATSAPP_LINK\}/)
  })
})

describe('privacy policy: WhatsApp Concierge disclosures', () => {
  const policy = text(renderToStaticMarkup(createElement(PrivacyPolicy)))

  it('says what the bot processes and why, and that WhatsApp is optional', () => {
    expect(policy).toContain(
      'we process your WhatsApp phone number (your WhatsApp ID), your WhatsApp profile name, the text of your messages and any attachments you send.'
    )
    expect(policy).toContain('to look up your vouchers')
    expect(policy).toContain('to route your request to our team when you ask for a person')
    expect(policy).toContain('WhatsApp support is optional: you can always contact us by email at contact@golandly.com instead.')
  })

  it('names Meta as the processor', () => {
    expect(policy).toContain('Meta Platforms, Inc. (WhatsApp Cloud API): the communication infrastructure')
  })

  it('discloses the retention the code enforces', () => {
    expect(MESSAGE_TTL_MS).toBe(180 * DAY_MS)
    expect(policy).toContain('WhatsApp support transcripts')
    expect(policy).toContain('are kept for 180 days for audit and dispute resolution, then deleted automatically.')
    for (const lang of LANGS) expect(translations[lang].pp_retention_10, lang).toContain('180')
  })

  it('has the new strings in all five languages', () => {
    const keys = ['pp_collect_whatsapp_h', 'pp_collect_whatsapp_1', 'pp_collect_whatsapp_2', 'pp_collect_whatsapp_3', 'pp_providers_9', 'pp_retention_10'] as const
    for (const lang of LANGS) {
      for (const key of keys) expect(translations[lang][key], `${lang}.${key}`).toBeTruthy()
      expect(translations[lang].pp_providers_9, lang).toContain('**Meta Platforms, Inc. (WhatsApp Cloud API)**')
      expect(translations[lang].pp_collect_whatsapp_3, lang).toContain('{email}')
      expect(translations[lang].pp_contact_4, lang).toContain('{whatsapp}')
    }
  })
})

describe('Firestore TTL policies back the retention promises', () => {
  const overrides: { collectionGroup: string; fieldPath: string; ttl?: boolean }[] = JSON.parse(readFileSync('firebase.indexes.json', 'utf8')).fieldOverrides

  it.each(['messages', 'whatsappInbound'])('expires %s on expiresAt', (group) => {
    expect(overrides).toContainEqual(expect.objectContaining({ collectionGroup: group, fieldPath: 'expiresAt', ttl: true }))
  })
})

describe('terms: WhatsApp support', () => {
  it.each(LANGS)('states 24/7 automation and human hours (%s)', (lang) => {
    const t = translations[lang]
    expect(t.terms_h8.startsWith('8. ')).toBe(true)
    expect(t.terms_p8).toContain('09:00')
    expect(t.terms_p8).toContain('18:00')
    expect(t.terms_p8).toContain('contact@golandly.com')
  })

  it('matches the hours the bot gives when it hands over to the team', () => {
    expect(translations.en.terms_p8).toContain('Sunday through Thursday, 09:00–18:00 Israel Time (IST)')
    expect(translations.en.wa_bot_team_confirm).toContain('Sun-Thu 09:00–18:00')
  })
})

describe('floating WhatsApp widget clearance', () => {
  // Bars stuck to the bottom of the screen on pages that show the widget: it rises above each.
  it.each(['app/offers/[offerId]/page.tsx', 'app/order-success/page.tsx', 'components/layout/CookieNotice.tsx'])('%s marks its bottom bar', (file) => {
    expect(readFileSync(file, 'utf8')).toMatch(/data-floating-clearance=""[^>]*(sticky|fixed) bottom-0/)
  })
})

describe('native Support screen', () => {
  const support = readFileSync('landly-mobile/src/app/settings/support.tsx', 'utf8')

  it('shows the WhatsApp logo in WhatsApp green', () => {
    expect(support).toContain("const WHATSAPP_GREEN = '#25D366'")
    expect(support).toContain('icon="whatsapp"')
    expect(support).not.toContain('icon="chat"')
    const web = readFileSync('components/layout/WhatsAppWidget.tsx', 'utf8').match(/d="(M16\.04[^"]+)"/)?.[1]
    expect(web).toBeTruthy()
    expect(support).toContain(`'${web}'`)
  })

  it('opens the shared number', () => {
    expect(support).toContain('SUPPORT_WHATSAPP_NUMBER')
    expect(support).not.toMatch(/9725\d{8}/)
  })
})
