import { describe, expect, it, vi } from 'vitest'
import {
  businessNameOverridesOf,
  businessNameVariants,
  isHebrewScriptName,
  localizedBusinessName,
  parseBusinessTranslations,
} from '@/lib/business/businessText'
import { buildBusinessTranslations, parseBusinessNameOverrides } from '@/lib/translate/businessTranslations'
import { hashSource, type Translator } from '@/lib/translate/offerTranslations'
import { offerMatchesSearch } from '@/lib/perks/perksFilter'
import type { OfferDocument } from '@/lib/firebase/offers'

function fakeTranslator() {
  const translate = vi.fn(async (texts: string[], target: string) => texts.map((text) => `[${target}] ${text}`))
  const detect = vi.fn(async () => 'iw')
  return { translator: { detect, translate } satisfies Translator, translate, detect }
}

describe('buildBusinessTranslations', () => {
  it('translates a Hebrew name into the four other languages without detecting', async () => {
    const { translator, translate, detect } = fakeTranslator()
    const { translations, warning } = await buildBusinessTranslations('מזנונקי', null, {}, translator)
    expect(warning).toBeNull()
    expect(detect).not.toHaveBeenCalled()
    expect(translations.sourceLang).toBe('he')
    expect(translate).toHaveBeenCalledTimes(4)
    expect(translations.fields.en?.businessName).toEqual({ text: '[en] מזנונקי', sourceHash: hashSource('מזנונקי'), machine: true })
    expect(Object.keys(translations.fields).sort()).toEqual(['en', 'es', 'fr', 'ru'])
  })

  it('leaves a Latin-script brand as written, with no API call and no warning', async () => {
    const { translator, translate } = fakeTranslator()
    const { translations, warning } = await buildBusinessTranslations('Coffee Bean', null, {}, translator)
    expect(translate).not.toHaveBeenCalled()
    expect(warning).toBeNull()
    expect(translations).toEqual({ sourceLang: 'en', fields: {} })
  })

  it('keeps an admin’s own wording for a Latin name (e.g. its Hebrew spelling)', async () => {
    const { translations } = await buildBusinessTranslations('Aroma', null, { he: { businessName: 'ארומה' } }, fakeTranslator().translator)
    expect(translations.fields.he?.businessName).toMatchObject({ text: 'ארומה', machine: false })
    expect(translations.fields.en).toBeUndefined()
  })

  it('costs nothing when the name is unchanged, and keeps manual wording across a rename', async () => {
    const first = await buildBusinessTranslations('מזנונקי', null, { en: { businessName: 'Miznonki' } }, fakeTranslator().translator)
    const { translator, translate } = fakeTranslator()
    const again = await buildBusinessTranslations('מזנונקי', first.translations, businessNameOverridesOf(first.translations), translator)
    expect(translate).not.toHaveBeenCalled()
    expect(again.translations).toEqual(first.translations)

    const renamed = await buildBusinessTranslations('מזנון', first.translations, businessNameOverridesOf(first.translations), fakeTranslator().translator)
    expect(renamed.translations.fields.en?.businessName?.text).toBe('Miznonki')
    expect(renamed.translations.fields.fr?.businessName?.text).toBe('[fr] מזנון')
  })

  it('drops Google’s wording when a Hebrew name becomes a Latin one', async () => {
    const first = await buildBusinessTranslations('מזנונקי', null, {}, fakeTranslator().translator)
    const { translations } = await buildBusinessTranslations('Miznonki', first.translations, {}, fakeTranslator().translator)
    expect(translations).toEqual({ sourceLang: 'en', fields: {} })
  })

  it('warns, prefixed, when translation is off for a Hebrew name', async () => {
    const { warning, translations } = await buildBusinessTranslations('מזנונקי', null, {}, null)
    expect(warning).toMatch(/^Business name: /)
    expect(translations.fields).toEqual({})
  })
})

describe('parseBusinessNameOverrides', () => {
  it('accepts the name field only', () => {
    expect(parseBusinessNameOverrides({ en: { businessName: '  Miznonki ' } })).toEqual({ ok: true, overrides: { en: { businessName: 'Miznonki' } } })
    expect(parseBusinessNameOverrides({ en: { title: 'x' } }).ok).toBe(false)
    expect(parseBusinessNameOverrides({ de: { businessName: 'x' } }).ok).toBe(false)
    expect(parseBusinessNameOverrides(undefined)).toEqual({ ok: true, overrides: {} })
  })
})

describe('reading a business name', () => {
  const stored = {
    sourceLang: 'he',
    fields: { en: { businessName: { text: 'Miznonki', sourceHash: 'h', machine: false } }, ru: { businessName: { text: 'Мизнонки', sourceHash: 'h', machine: true } } },
  }

  it('parses stored translations defensively', () => {
    expect(parseBusinessTranslations(stored)).toEqual(stored)
    expect(parseBusinessTranslations({ sourceLang: 'he', fields: { en: { title: { text: 'x', sourceHash: 'h' } } } })).toEqual({ sourceLang: 'he', fields: {} })
    expect(parseBusinessTranslations('nope')).toBeNull()
  })

  it('shows the reader’s language, else the name as written', () => {
    const item = { businessName: 'מזנונקי', businessTranslations: parseBusinessTranslations(stored) }
    expect(localizedBusinessName(item, 'en')).toEqual({ text: 'Miznonki', lang: 'en', machine: false })
    expect(localizedBusinessName(item, 'ru')).toEqual({ text: 'Мизнонки', lang: 'ru', machine: true })
    expect(localizedBusinessName(item, 'he').text).toBe('מזנונקי')
    expect(localizedBusinessName(item, 'fr')).toEqual({ text: 'מזנונקי', lang: 'he', machine: false })
    expect(localizedBusinessName({ businessName: 'Aroma' }, 'he').text).toBe('Aroma')
    expect(localizedBusinessName(null, 'en').text).toBe('')
  })

  it('finds a business by any of its names', () => {
    const item = { businessName: 'מזנונקי', businessTranslations: parseBusinessTranslations(stored) }
    expect(businessNameVariants(item)).toEqual(['מזנונקי', 'Miznonki', 'Мизнонки'])
    const offer = { id: 'o1', title: 'Hummus', businessName: 'מזנונקי', businessTranslations: item.businessTranslations, category: 'Restaurants and Cafes' } as OfferDocument
    expect(offerMatchesSearch(offer, 'miznonki')).toBe(true)
    expect(offerMatchesSearch(offer, 'מזנונ')).toBe(true)
    expect(offerMatchesSearch(offer, 'aroma')).toBe(false)
  })

  it('tells Hebrew-script names apart', () => {
    expect(isHebrewScriptName('מזנונקי')).toBe(true)
    expect(isHebrewScriptName('Café קפה')).toBe(true)
    expect(isHebrewScriptName('Coffee Bean')).toBe(false)
  })
})
