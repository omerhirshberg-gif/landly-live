import { describe, expect, it } from 'vitest'
import { en as adminEn } from '@/lib/admin/translations/en'
import { he as adminHe } from '@/lib/admin/translations/he'
import { LANGUAGES } from '@/lib/i18n/languages'
import { translations } from '@/lib/i18n/translations'

// Every language carries exactly the keys English does, each with a real string:
// a key added to English alone would silently fall back to English for a Russian,
// French, Spanish or Hebrew member (and a mail or WhatsApp message in that language).
const codes = Object.keys(translations) as (keyof typeof translations)[]
const english = Object.keys(translations.en)

describe('site dictionary parity', () => {
  it('lists the same five languages in the picker and the dictionary', () => {
    expect([...codes].sort()).toEqual(['en', 'es', 'fr', 'he', 'ru'])
    expect(LANGUAGES.map((language) => language.code).sort()).toEqual([...codes].sort())
  })

  for (const code of codes.filter((c) => c !== 'en')) {
    it(`${code} has every English key, no extras, and no empty values`, () => {
      const dictionary = translations[code] as Record<string, string>
      const keys = Object.keys(dictionary)
      expect(english.filter((key) => !keys.includes(key)), `missing from ${code}`).toEqual([])
      expect(keys.filter((key) => !english.includes(key)), `only in ${code}`).toEqual([])
      expect(keys.filter((key) => typeof dictionary[key] !== 'string' || dictionary[key].trim() === ''), `empty in ${code}`).toEqual([])
    })

    it(`${code} keeps the {placeholders} English uses`, () => {
      const dictionary = translations[code] as Record<string, string>
      const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort()
      const broken = english.filter((key) => {
        const source = (translations.en as Record<string, string>)[key]
        return source && dictionary[key] && placeholders(source).join() !== placeholders(dictionary[key]).join()
      })
      expect(broken, `placeholders differ in ${code}`).toEqual([])
    })
  }
})

describe('admin dictionary parity (English and Hebrew only, by design)', () => {
  it('has the same keys, no empty values, and the same {placeholders}', () => {
    const enKeys = Object.keys(adminEn)
    const heKeys = Object.keys(adminHe)
    expect(enKeys.filter((key) => !heKeys.includes(key))).toEqual([])
    expect(heKeys.filter((key) => !enKeys.includes(key))).toEqual([])
    const en = adminEn as Record<string, string>
    const he = adminHe as Record<string, string>
    expect(enKeys.filter((key) => !en[key]?.trim() || !he[key]?.trim())).toEqual([])
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join()
    // A singular (`.one`) may say "one voucher" instead of "{n} voucher", in either language.
    expect(enKeys.filter((key) => !key.endsWith('.one') && placeholders(en[key]) !== placeholders(he[key]))).toEqual([])
  })
})
