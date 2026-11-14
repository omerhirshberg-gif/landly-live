import { describe, expect, it } from 'vitest'
import { normalizeOtpPhone, otpCopyKeys, resolveOtpChannel, splitAtPlaceholder } from '@/lib/auth/otpChannel'
import { translations, type Lang } from '@/lib/i18n/translations'

describe('resolveOtpChannel', () => {
  it.each([
    '+972501234567',
    '972501234567',
    '  +972 50-123-4567',
    '-972501234567',
    '+972 (50) 123.4567',
    '00972501234567',
    '‎+972501234567',
  ])('sends an Israeli number (%j) by SMS', (phone) => {
    expect(resolveOtpChannel(phone)).toBe('sms')
  })

  it.each(['+12025550123', '+33612345678', '+447911123456', '+79161234567', '+971501234567', '+9705991234', '+97312345678', '12025550123'])(
    'sends every other country (%s) by WhatsApp',
    (phone) => {
      expect(resolveOtpChannel(phone)).toBe('whatsapp')
    }
  )

  it('normalises to the bare digits', () => {
    expect(normalizeOtpPhone(' +972-50 123 4567')).toBe('972501234567')
    expect(normalizeOtpPhone('00 1 202')).toBe('1202')
  })
})

describe('channel copy', () => {
  const langs = Object.keys(translations) as Lang[]

  it.each(langs)('has SMS and WhatsApp copy with a {phone} placeholder in %s', (lang) => {
    for (const channel of ['sms', 'whatsapp'] as const) {
      const keys = otpCopyKeys(channel)
      for (const key of [keys.pendingBody, keys.subtitle]) {
        expect(translations[lang][key], `${lang}.${key}`).toContain('{phone}')
      }
      expect(translations[lang][keys.title]).toBeTruthy()
    }
    expect(translations[lang].otp_subtitle_sms).toMatch(/SMS/)
    expect(translations[lang].otp_subtitle_whatsapp).toMatch(/WhatsApp|וואטסאפ/)
  })

  it('splits a message around its placeholder', () => {
    expect(splitAtPlaceholder('via SMS to {phone}.', '{phone}')).toEqual(['via SMS to ', '.'])
    expect(splitAtPlaceholder('no placeholder', '{phone}')).toEqual(['no placeholder', ''])
  })
})
