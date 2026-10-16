import { describe, expect, it } from 'vitest'
import { DEFAULT_COUNTRY, formatPhone, phoneToE164, splitPhone } from '@/lib/auth/onboarding'

// The Expo Profile tab edits users/{uid}.phone: the stored E.164 number is
// split back into the picker's country and digits, and shown formatted.
describe('splitPhone', () => {
  it('splits an Israeli number into IL and its national digits', () => {
    expect(splitPhone('+972501234567')).toEqual({ country: 'IL', national: '501234567' })
  })

  it('splits a US number into US and its national digits', () => {
    expect(splitPhone('+12025550123')).toEqual({ country: 'US', national: '2025550123' })
  })

  it('starts empty on the default country when no number is stored', () => {
    expect(splitPhone('')).toEqual({ country: DEFAULT_COUNTRY, national: '' })
  })

  it('keeps unparsable text on the default country', () => {
    expect(splitPhone('abc')).toEqual({ country: DEFAULT_COUNTRY, national: 'abc' })
  })

  it('round-trips through phoneToE164', () => {
    for (const e164 of ['+972501234567', '+12025550123', '+447911123456']) {
      const { country, national } = splitPhone(e164)
      expect(phoneToE164(country, national)).toBe(e164)
    }
  })
})

describe('formatPhone', () => {
  it('formats stored numbers internationally', () => {
    expect(formatPhone('+972501234567')).toBe('+972 50 123 4567')
    expect(formatPhone('+12025550123')).toBe('+1 202 555 0123')
  })

  it('shows anything unparsable as stored', () => {
    expect(formatPhone('abc')).toBe('abc')
    expect(formatPhone('')).toBe('')
  })
})
