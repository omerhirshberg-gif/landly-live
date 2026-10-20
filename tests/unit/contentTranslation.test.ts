import { describe, expect, it } from 'vitest'
import { directionOf, localizeText, parseContentTranslations, showsMachineTranslation } from '@/lib/i18n/contentTranslation'
import { manualOverridesOf, offerTextSources, parseOfferTranslations, type OfferTranslations } from '@/lib/offers/offerText'

const stored: OfferTranslations = {
  sourceLang: 'he',
  fields: {
    en: { title: { text: '1+1 on coffee', sourceHash: 'h1', machine: true }, redemptionTerms: { text: 'Sun–Thu only', sourceHash: 'h2', machine: false } },
    ru: { title: { text: '1+1 на кофе', sourceHash: 'h1', machine: true } },
  },
}

describe('localizeText', () => {
  it('returns the translation in the reader’s language', () => {
    expect(localizeText('1+1 על קפה', stored, 'en', 'title')).toEqual({ text: '1+1 on coffee', lang: 'en', machine: true })
  })

  it('falls back to the source, in its own language, when a language or field is missing', () => {
    expect(localizeText('1+1 על קפה', stored, 'fr', 'title')).toEqual({ text: '1+1 על קפה', lang: 'he', machine: false })
    expect(localizeText('תיאור', stored, 'en', 'description')).toEqual({ text: 'תיאור', lang: 'he', machine: false })
  })

  it('shows the source to readers of the source language', () => {
    expect(localizeText('1+1 על קפה', stored, 'he', 'title').text).toBe('1+1 על קפה')
  })

  it('marks an admin’s own wording as not machine-made', () => {
    expect(localizeText('א׳–ה׳ בלבד', stored, 'en', 'redemptionTerms')).toEqual({ text: 'Sun–Thu only', lang: 'en', machine: false })
  })

  it('handles content with no translations at all', () => {
    expect(localizeText('Coffee', null, 'he', 'title')).toEqual({ text: 'Coffee', lang: null, machine: false })
  })

  it('never shows a translation of an empty source', () => {
    expect(localizeText('', stored, 'en', 'title').text).toBe('')
  })
})

describe('showsMachineTranslation', () => {
  it('is true only when a shown field is Google’s wording', () => {
    expect(showsMachineTranslation(stored, 'en', { title: 'x' })).toBe(true)
    expect(showsMachineTranslation(stored, 'en', { redemptionTerms: 'x' })).toBe(false)
    expect(showsMachineTranslation(stored, 'he', { title: 'x' })).toBe(false)
    expect(showsMachineTranslation(stored, 'en', { title: '' })).toBe(false)
  })
})

describe('parseContentTranslations', () => {
  it('drops unknown languages, unknown fields and malformed entries', () => {
    const parsed = parseOfferTranslations({
      sourceLang: 'he',
      fields: {
        en: { title: { text: 'Hi', sourceHash: 'a', machine: true }, bogus: { text: 'x', sourceHash: 'b' }, description: { text: 5 } },
        xx: { title: { text: 'nope', sourceHash: 'c' } },
      },
    })
    expect(parsed).toEqual({ sourceLang: 'he', fields: { en: { title: { text: 'Hi', sourceHash: 'a', machine: true } } } })
  })

  it('returns null for anything that isn’t a translations map', () => {
    expect(parseContentTranslations(null, ['title'])).toBeNull()
    expect(parseContentTranslations({ fields: {} }, ['title'])).toBeNull()
    expect(parseContentTranslations('he', ['title'])).toBeNull()
  })
})

describe('manualOverridesOf / offerTextSources', () => {
  it('keeps only the admin’s own wording', () => {
    expect(manualOverridesOf(stored)).toEqual({ en: { redemptionTerms: 'Sun–Thu only' } })
    expect(manualOverridesOf(null)).toEqual({})
  })

  it('reads a voucher’s offerTitle as the title', () => {
    expect(offerTextSources({ offerTitle: 'T', redemptionTerms: 'R' })).toEqual({ title: 'T', description: '', redemptionTerms: 'R', redemptionInstructions: '' })
    expect(offerTextSources(undefined).title).toBe('')
  })
})

describe('directionOf', () => {
  it('knows right-to-left languages, including Google’s old Hebrew code', () => {
    expect(directionOf('he')).toBe('rtl')
    expect(directionOf('iw')).toBe('rtl')
    expect(directionOf('en')).toBe('ltr')
    expect(directionOf(null)).toBeUndefined()
  })
})
