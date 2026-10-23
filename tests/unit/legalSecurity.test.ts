import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PrivacyPolicy from '@/components/legal/PrivacyPolicy'
import TermsContent from '@/components/legal/TermsContent'
import { SESSION_MAX_IDLE_MS } from '@/lib/auth/appLockPolicy'
import { SUPPORT_EMAIL } from '@/lib/config'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { isolateEmails, splitEmails } from '@/lib/legal/bidi'
import { PRIVACY_POLICY_STRUCTURE, blockTexts, privacyPolicy } from '@/lib/legal/privacyPolicyContent'
import { TERMS_SECTIONS } from '@/lib/legal/termsSections'
import { CANCELLATION_WINDOW_DAYS } from '@/lib/payments/voucherTerms'

// The legal text states numbers and behaviours that live in code. Each one is
// read from its source here, so changing the code without the policy and the
// Terms (in all five languages) fails this file.
const LANGS: Lang[] = ['en', 'he', 'ru', 'es', 'fr']
const read = (path: string) => readFileSync(path, 'utf8')
const tr = (lang: Lang, key: TranslationKey) => translations[lang][key]

const constant = (path: string, name: string) => {
  const m = read(path).match(new RegExp(`const ${name}\\s*=\\s*([\\d_]+)`))
  if (!m) throw new Error(`${name} not found in ${path}`)
  return Number(m[1].replace(/_/g, ''))
}
const GRACE_SECONDS = constant('landly-mobile/src/auth/AppLock.tsx', 'APP_LOCK_GRACE_MS') / 1000
const IDLE_DAYS = SESSION_MAX_IDLE_MS / 86_400_000
const GEO_CACHE_DAYS = constant('app/api/geo/reverse/route.ts', 'CACHE_DAYS')

const legalKeys = (Object.keys(translations.en) as TranslationKey[]).filter(
  (k) => k.startsWith('pp_') || k.startsWith('terms_') || k === 'legal_translation_notice'
)
const policyKeys = PRIVACY_POLICY_STRUCTURE.flatMap((s) => [s.title, ...s.blocks.flatMap((b) => ('key' in b ? [b.key] : b.keys))])

function renderTerms(lang: Lang) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(TermsContent)))
}

describe('legal text matches the code', () => {
  it('reads the constants it checks', () => {
    expect(GRACE_SECONDS).toBe(60)
    expect(IDLE_DAYS).toBe(30)
    expect(GEO_CACHE_DAYS).toBe(30)
    expect(CANCELLATION_WINDOW_DAYS).toBe(14)
  })

  it.each(LANGS)('states the app lock grace period and the per-device 30-day sign-out (%s)', (lang) => {
    for (const key of ['pp_signin_how_2', 'pp_protect_5', 'terms_p5b'] as const) expect(tr(lang, key), key).toContain(`60`)
    for (const key of ['pp_signin_how_3', 'pp_protect_5', 'terms_p5b'] as const) expect(tr(lang, key), key).toContain(`${IDLE_DAYS}`)
    expect(tr(lang, 'pp_signin_how_2')).toContain(`${GRACE_SECONDS}`)
  })

  it.each(LANGS)('names the exact secure-storage keys the app writes (%s)', (lang) => {
    const source = read('landly-mobile/src/auth/biometricLock.ts')
    expect(source).toContain('`landly.applock.${uid}`')
    expect(source).toContain('`landly.applock.lastEntry.${uid}`')
    expect(source).toContain('WHEN_UNLOCKED_THIS_DEVICE_ONLY')
    expect(tr(lang, 'pp_signin_lock_2')).toContain('`landly.applock.<uid>`')
    expect(tr(lang, 'pp_signin_lock_2')).toContain('`landly.applock.lastEntry.<uid>`')
    expect(tr(lang, 'pp_signin_lock_1')).toContain('Secure Enclave')
  })

  it('backs the "on by default where biometrics are set up" statement', () => {
    expect(read('lib/auth/appLockPolicy.ts')).toContain('return device.hardware && device.enrolled')
    expect(tr('en', 'pp_signin_how_1')).toContain('on by default on devices where Face ID, Touch ID or fingerprint or face unlock is set up')
  })

  it.each(LANGS)('discloses the anonymous ~1 km geocode cache and its 30-day limit (%s)', (lang) => {
    expect(tr(lang, 'pp_collect_location_2')).toContain('1')
    expect(tr(lang, 'pp_collect_location_3')).toContain(`${GEO_CACHE_DAYS}`)
    expect(tr(lang, 'pp_retention_8')).toContain(`${GEO_CACHE_DAYS}`)
  })

  it('caches only a city per rounded point, never who asked', () => {
    const route = read('app/api/geo/reverse/route.ts')
    expect(route).toMatch(/cacheRef\.set\(\{ city, expiresAt: [^}]+\}\)/)
    expect(route).not.toMatch(/uid|getIdToken|authorization/i)
    expect(read('lib/geo.ts')).toContain('const { lat, lng } = roundCoordinates(coords)')
  })

  it('never asks for background location, as the policy says', () => {
    const plugin = JSON.stringify(JSON.parse(read('landly-mobile/app.json')))
    for (const flag of ['"locationAlwaysAndWhenInUsePermission":false', '"locationAlwaysPermission":false', '"isIosBackgroundLocationEnabled":false', '"isAndroidBackgroundLocationEnabled":false']) {
      expect(plugin).toContain(flag)
    }
    expect(tr('en', 'pp_collect_location_1')).toContain('never asks for background location access')
  })

  it('lists every field a stored passkey record holds', () => {
    const route = read('app/api/auth/passkey/register-verify/route.ts')
    const record = route.match(/const record = \{([\s\S]*?)\n\s*\}/)![1]
    const fields = [...record.matchAll(/^\s*(\w+)[,:]/gm)].map((m) => m[1]).sort()
    expect(fields).toEqual(['aaguid', 'backedUp', 'counter', 'deviceType', 'name', 'publicKey', 'transports', 'uid', 'webauthnUserId'].sort())
    const text = tr('en', 'pp_signin_passkey_2')
    for (const phrase of ['public key', 'signature counter', 'connection types', 'device type', 'synced', 'AAGUID', 'name we generate', 'created and last used']) {
      expect(text).toContain(phrase)
    }
  })

  it('gives partner businesses only the voucher reference, offer and dates', () => {
    const route = read('app/api/business/vouchers/route.ts')
    const shape = route.match(/return \{\n([\s\S]*?)\n\s*\}\n\s*\}\)/)![1]
    expect([...shape.matchAll(/^\s*(\w+):/gm)].map((m) => m[1])).toEqual(['id', 'offerTitle', 'takenAt', 'redeemedAt'])
    expect(tr('en', 'pp_partners_p1')).toContain("the voucher's reference, the offer and the dates it was claimed and redeemed")
  })

  it.each(LANGS)('cites the statutory 14-day cancellation window and Tranzila card handling (%s)', (lang) => {
    expect(tr(lang, 'terms_p2a')).toContain(`${CANCELLATION_WINDOW_DAYS}`)
    expect(tr(lang, 'terms_p2a')).toContain('1981') // 5741-1981; Hebrew cites it by its Hebrew year, התשמ״א-1981
    for (const key of ['terms_p1', 'pp_collect_payment_2'] as const) {
      expect(tr(lang, key)).toContain('Tranzila')
      expect(tr(lang, key)).toContain('PCI-DSS')
      expect(tr(lang, key)).toContain('CVV')
    }
  })
})

describe('legal entity, contact and governing law', () => {
  it.each(LANGS)('names the entity "Landly" with no company suffix (%s)', (lang) => {
    for (const key of legalKeys) expect(tr(lang, key), `${lang}.${key}`).not.toMatch(/\bLtd\b|בע״מ|בע"מ|Ltée|\bS\.?L\.?\b|\bS\.A\.?\b|\bSARL\b|ООО|\bInc\b/)
  })

  it.each(LANGS)('points every address at the support email (%s)', (lang) => {
    const emails = new Set(legalKeys.flatMap((key) => tr(lang, key).match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? []))
    expect([...emails]).toEqual([SUPPORT_EMAIL])
    expect(SUPPORT_EMAIL).toBe('contact@golandly.com')
    expect(tr(lang, 'terms_p7')).toContain(SUPPORT_EMAIL)
  })

  it.each(LANGS)('numbers the seven Terms sections 1 to 7 in order (%s)', (lang) => {
    expect(TERMS_SECTIONS.map((s) => tr(lang, s.heading).match(/^(\d)\. /)?.[1])).toEqual(['1', '2', '3', '4', '5', '6', '7'])
  })

  it.each(LANGS)('gives Tel Aviv-Yafo courts exclusive jurisdiction under Israeli law (%s)', (lang) => {
    const law = tr(lang, 'terms_p6')
    expect(law).toMatch(/Tel Aviv|Тель-Авив|תל אביב/)
    expect(law).toMatch(/exclusive|exclusiva|exclusive|Исключительная|ייחודית/i)
  })
})

describe('five-language parity', () => {
  it.each(LANGS.filter((l) => l !== 'en'))('translates every legal string (%s)', (lang) => {
    // Lines that are the same in any language: the brand, and Spanish keeps the city's English spelling.
    const same = new Set<string>(['pp_contact_1', ...(lang === 'es' ? ['pp_contact_2'] : [])])
    for (const key of legalKeys) {
      expect(tr(lang, key).trim(), `${lang}.${key}`).not.toBe('')
      if (!same.has(key)) expect(tr(lang, key), `${lang}.${key} is still English`).not.toBe(tr('en', key))
    }
  })

  it('renders every policy key in every language', () => {
    for (const lang of LANGS) {
      const text = privacyPolicy(lang).sections.flatMap((s) => s.blocks.flatMap(blockTexts)).join('\n')
      expect(text.length, lang).toBeGreaterThan(10_000)
    }
    expect(new Set(policyKeys).size).toBe(policyKeys.length)
  })

  it('says the English policy governs, on the page and in the text', () => {
    expect(tr('en', 'pp_changes_p1')).toContain('The English version of this policy is the governing version')
    expect(renderToStaticMarkup(createElement(PrivacyPolicy, { lang: 'fr' }))).toContain(`role="note"`)
    expect(renderToStaticMarkup(createElement(PrivacyPolicy, { lang: 'fr' }))).toContain(translations.fr.legal_translation_notice.replace(/'/g, '&#x27;'))
    expect(renderToStaticMarkup(createElement(PrivacyPolicy))).not.toContain('role="note"')
  })
})

describe('Hebrew: right to left, with left-to-right tokens isolated', () => {
  const policy = renderToStaticMarkup(createElement(PrivacyPolicy, { lang: 'he' }))
  const terms = renderTerms('he')

  it('mirrors the policy and the terms', () => {
    expect(policy).toMatch(/^<article lang="he" dir="rtl"/)
    expect(terms).toMatch(/^<article dir="rtl"/)
    expect(renderToStaticMarkup(createElement(PrivacyPolicy))).toMatch(/^<article lang="en" dir="ltr"/)
  })

  it('wraps the email, phone, URLs and code in <bdi>', () => {
    expect(policy).toMatch(/<bdi><a href="mailto:contact@golandly.com"/)
    expect(policy).toMatch(/<bdi dir="ltr"><a href="tel:/)
    expect(policy).toMatch(/<bdi><a href="https:\/\/www.golandly.com"/)
    expect(policy).toContain('<bdi><code class="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em]">landly.applock.&lt;uid&gt;</code></bdi>')
    expect(policy).not.toMatch(/<bdi><a href="#/)
    expect(terms).toContain('<bdi>contact@golandly.com</bdi>')
  })

  it('isolates emails for native text', () => {
    expect(splitEmails('כתבו אל contact@golandly.com.')).toEqual([
      { text: 'כתבו אל ', ltr: false },
      { text: 'contact@golandly.com', ltr: true },
      { text: '.', ltr: false },
    ])
    expect(isolateEmails('אל contact@golandly.com.')).toBe('אל ⁨contact@golandly.com⁩.')
  })
})
