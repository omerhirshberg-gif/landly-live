import { describe, expect, it, vi } from 'vitest'
import {
  buildOfferTranslations,
  guessLanguage,
  hashSource,
  normalizeLanguageCode,
  parseTranslationOverrides,
  type OfferTextSource,
  type Translator,
} from '@/lib/translate/offerTranslations'

const source: OfferTextSource = {
  title: '1+1 על קפה',
  description: 'בכל הסניפים',
  redemptionTerms: '',
  redemptionInstructions: '',
}

function fakeTranslator(detected = 'iw') {
  const translate = vi.fn(async (texts: string[], target: string) => texts.map((text) => `[${target}] ${text}`))
  const detect = vi.fn(async () => detected)
  return { translator: { detect, translate } satisfies Translator, translate, detect }
}

describe('buildOfferTranslations', () => {
  it('translates every filled field into the four other languages, detecting the source', async () => {
    const { translator, translate } = fakeTranslator()
    const { translations, warning, translatedCount } = await buildOfferTranslations(source, null, {}, translator)
    expect(warning).toBeNull()
    expect(translations.sourceLang).toBe('he')
    expect(Object.keys(translations.fields).sort()).toEqual(['en', 'es', 'fr', 'ru'])
    expect(translations.fields.en?.title).toEqual({ text: '[en] 1+1 על קפה', sourceHash: hashSource(source.title), machine: true })
    expect(translations.fields.en?.redemptionTerms).toBeUndefined()
    // One batched call per target language.
    expect(translate).toHaveBeenCalledTimes(4)
    expect(translatedCount).toBe(8)
  })

  it('costs nothing when the text didn’t change', async () => {
    const first = await buildOfferTranslations(source, null, {}, fakeTranslator().translator)
    const { translator, translate, detect } = fakeTranslator()
    const second = await buildOfferTranslations(source, first.translations, {}, translator)
    expect(translate).not.toHaveBeenCalled()
    expect(detect).not.toHaveBeenCalled()
    expect(second.translations).toEqual(first.translations)
  })

  it('re-translates only the field whose source changed', async () => {
    const first = await buildOfferTranslations(source, null, {}, fakeTranslator().translator)
    const { translator, translate } = fakeTranslator()
    const edited = { ...source, description: 'רק בתל אביב' }
    const { translations } = await buildOfferTranslations(edited, first.translations, {}, translator)
    expect(translate).toHaveBeenCalledTimes(4)
    for (const call of translate.mock.calls) expect(call[0]).toEqual(['רק בתל אביב'])
    expect(translations.fields.fr?.title).toEqual(first.translations.fields.fr?.title)
    expect(translations.fields.fr?.description?.text).toBe('[fr] רק בתל אביב')
  })

  it('keeps an admin’s own wording, even after the source changes', async () => {
    const { translator, translate } = fakeTranslator()
    const first = await buildOfferTranslations(source, null, { en: { title: 'Two coffees for one' } }, translator)
    expect(first.translations.fields.en?.title).toEqual({ text: 'Two coffees for one', sourceHash: hashSource(source.title), machine: false })
    expect(translate.mock.calls.find((call) => call[1] === 'en')?.[0]).toEqual([source.description])

    const second = await buildOfferTranslations({ ...source, title: '2+1 על קפה' }, first.translations, { en: { title: 'Two coffees for one' } }, fakeTranslator().translator)
    expect(second.translations.fields.en?.title?.text).toBe('Two coffees for one')
    expect(second.translations.fields.ru?.title?.text).toBe('[ru] 2+1 על קפה')
  })

  it('hands a field back to Google when its override is dropped', async () => {
    const first = await buildOfferTranslations(source, null, { en: { title: 'Mine' } }, fakeTranslator().translator)
    const { translator } = fakeTranslator()
    const { translations } = await buildOfferTranslations(source, first.translations, {}, translator)
    expect(translations.fields.en?.title).toMatchObject({ text: '[en] 1+1 על קפה', machine: true })
  })

  it('saves without the failed languages and says so', async () => {
    const translate = vi.fn(async (texts: string[], target: string) => {
      if (target === 'ru') throw new Error('quota')
      return texts.map((text) => `[${target}] ${text}`)
    })
    const { translations, warning } = await buildOfferTranslations(source, null, {}, { detect: async () => 'he', translate })
    expect(warning).toMatch(/failed/)
    expect(translations.fields.ru).toBeUndefined()
    expect(translations.fields.en?.title?.text).toBe('[en] 1+1 על קפה')
  })

  it('drops stale machine text when translation is switched off, keeping manual wording', async () => {
    const first = await buildOfferTranslations(source, null, { es: { title: 'Mío' } }, fakeTranslator().translator)
    const { translations, warning } = await buildOfferTranslations({ ...source, title: 'חדש' }, first.translations, { es: { title: 'Mío' } }, null)
    expect(warning).toMatch(/switched off/)
    expect(translations.fields.en?.title).toBeUndefined()
    expect(translations.fields.en?.description).toEqual(first.translations.fields.en?.description)
    expect(translations.fields.es?.title?.text).toBe('Mío')
  })

  it('treats English source text as English and translates into Hebrew', async () => {
    const { translator, translate } = fakeTranslator('en')
    const { translations } = await buildOfferTranslations({ ...source, title: 'Free dessert', description: '' }, null, {}, translator)
    expect(translations.sourceLang).toBe('en')
    expect(translations.fields.en).toBeUndefined()
    expect(translations.fields.he?.title?.text).toBe('[he] Free dessert')
    expect(translate.mock.calls.map((call) => call[1]).sort()).toEqual(['es', 'fr', 'he', 'ru'])
  })
})

describe('parseTranslationOverrides', () => {
  it('accepts known languages and fields, trimming and dropping empty text', () => {
    expect(parseTranslationOverrides({ en: { title: '  Hi  ', description: '   ' } })).toEqual({ ok: true, overrides: { en: { title: 'Hi' } } })
    expect(parseTranslationOverrides(undefined)).toEqual({ ok: true, overrides: {} })
  })

  it('rejects anything else', () => {
    expect(parseTranslationOverrides({ de: { title: 'x' } }).ok).toBe(false)
    expect(parseTranslationOverrides({ en: { price: 'x' } }).ok).toBe(false)
    expect(parseTranslationOverrides({ en: { title: 5 } }).ok).toBe(false)
    expect(parseTranslationOverrides({ en: { title: 'x'.repeat(2001) } }).ok).toBe(false)
    expect(parseTranslationOverrides([]).ok).toBe(false)
  })
})

describe('language codes', () => {
  it('normalizes Google’s codes to ours', () => {
    expect(normalizeLanguageCode('iw')).toBe('he')
    expect(normalizeLanguageCode('en-US')).toBe('en')
    expect(normalizeLanguageCode('und')).toBeNull()
    expect(normalizeLanguageCode(null)).toBeNull()
  })

  it('guesses Hebrew from its letters when the API isn’t available', () => {
    expect(guessLanguage('קפה')).toBe('he')
    expect(guessLanguage('Coffee')).toBe('en')
  })
})
