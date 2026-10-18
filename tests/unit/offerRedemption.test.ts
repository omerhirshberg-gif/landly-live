import { describe, expect, it } from 'vitest'
import {
  MAX_REDEMPTION_INSTRUCTIONS_LENGTH,
  instructionSteps,
  normalizeRedemptionMethod,
  parseOfferRedemption,
  redemptionSteps,
  REDEMPTION_METHOD_LABEL_KEYS,
  REDEMPTION_METHODS,
} from '@/lib/offers/redemption'
import { translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'

describe('parseOfferRedemption', () => {
  it('defaults to in-store with no instructions (older admin clients)', () => {
    expect(parseOfferRedemption({})).toEqual({ ok: true, redemptionMethod: 'in_store', redemptionInstructions: '' })
  })
  it('accepts the three methods and trims instructions', () => {
    for (const method of REDEMPTION_METHODS) {
      expect(parseOfferRedemption({ redemptionMethod: method, redemptionInstructions: '  Call ahead  ' }))
        .toEqual({ ok: true, redemptionMethod: method, redemptionInstructions: 'Call ahead' })
    }
  })
  it('rejects an unknown method, non-text and over-long instructions', () => {
    expect(parseOfferRedemption({ redemptionMethod: 'carrier_pigeon' })).toMatchObject({ ok: false })
    expect(parseOfferRedemption({ redemptionInstructions: 42 })).toMatchObject({ ok: false })
    expect(parseOfferRedemption({ redemptionInstructions: 'x'.repeat(MAX_REDEMPTION_INSTRUCTIONS_LENGTH + 1) })).toMatchObject({ ok: false })
  })
})

describe('normalizeRedemptionMethod', () => {
  it('reads anything unknown or missing as in-store', () => {
    expect(normalizeRedemptionMethod(undefined)).toBe('in_store')
    expect(normalizeRedemptionMethod('nonsense')).toBe('in_store')
    expect(normalizeRedemptionMethod('online')).toBe('online')
  })
})

describe('steps', () => {
  const t = (key: TranslationKey) => translations.en[key]

  it("splits the merchant's instructions into steps, dropping their own numbering and blank lines", () => {
    expect(instructionSteps('1. Call to book\n\n2) Mention Landly\n- Show the code ')).toEqual(['Call to book', 'Mention Landly', 'Show the code'])
  })
  it("uses the merchant's steps when given, else the method's defaults", () => {
    expect(redemptionSteps('online', 'Enter the code at checkout', t)).toEqual(['Enter the code at checkout'])
    expect(redemptionSteps('phone_booking', '   ', t)).toEqual([t('redeem_step_phone_call'), t('redeem_step_phone_show')])
  })
  it('has every label and step in all five languages', () => {
    const keys = Object.keys(translations.en).filter((k) => k.startsWith('redeem_')) as TranslationKey[]
    expect(keys.length).toBeGreaterThanOrEqual(11)
    for (const method of REDEMPTION_METHODS) expect(keys).toContain(REDEMPTION_METHOD_LABEL_KEYS[method])
    for (const lang of Object.keys(translations) as Lang[]) {
      for (const key of keys) expect(translations[lang][key], `${lang}.${key}`).toBeTruthy()
    }
  })
})
