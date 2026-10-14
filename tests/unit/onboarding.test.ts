import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COUNTRY,
  countryName,
  isPlausibleEmail,
  isProfileComplete,
  listCountries,
  ONBOARDING_LANGS,
  ONBOARDING_STEPS,
  nextStep,
  passwordStrength,
  phoneToE164,
  prevStep,
  signUpFormError,
  stepProgress,
} from '@/lib/auth/onboarding'
import { translations } from '@/lib/i18n/translations'

describe('step order', () => {
  it('runs the four post-sign-in cards in order, with no credentials among them', () => {
    expect(ONBOARDING_STEPS).toEqual(['language', 'persona', 'phone', 'notifications'])
  })

  it('moves forward and back between neighbours only', () => {
    expect(nextStep('language')).toBe('persona')
    expect(nextStep('notifications')).toBeNull()
    expect(prevStep('phone')).toBe('persona')
    expect(prevStep('language')).toBeNull()
  })

  it('offers every app language on the first card', () => {
    expect(ONBOARDING_LANGS.map((l) => l.code)).toEqual(['en', 'he', 'ru', 'fr', 'es'])
    expect(new Set(ONBOARDING_LANGS.map((l) => l.code))).toEqual(new Set(Object.keys(translations)))
  })

  it('reports progress out of four', () => {
    expect(stepProgress('language')).toEqual({ current: 1, total: 4 })
    expect(stepProgress('notifications')).toEqual({ current: 4, total: 4 })
  })
})

describe('identity and password', () => {
  it('accepts plausible emails and rejects obvious typos', () => {
    expect(isPlausibleEmail(' dana@example.co.il ')).toBe(true)
    expect(isPlausibleEmail('dana@example')).toBe(false)
    expect(isPlausibleEmail('dana example.com')).toBe(false)
  })

  it('checks the Sign Up form: email, length, then the confirmation', () => {
    expect(signUpFormError('dana@example', 'secret1', 'secret1')).toBe('onb_emailInvalid')
    expect(signUpFormError('dana@example.com', 'abc', 'abc')).toBe('onb_passwordTooShort')
    expect(signUpFormError('dana@example.com', 'secret1', 'secret2')).toBe('onb_passwordMismatch')
    expect(signUpFormError('dana@example.com', 'secret1', 'secret1')).toBeNull()
  })

  it('scores password strength', () => {
    expect(passwordStrength('')).toBe(0)
    expect(passwordStrength('abc12')).toBe(1)
    expect(passwordStrength('abcdefgh')).toBe(1)
    expect(passwordStrength('abcdefg1')).toBe(2)
    expect(passwordStrength('Abcdefgh1!')).toBe(3)
  })
})

describe('phone', () => {
  it('reads a local number in the selected country and stores E.164', () => {
    expect(DEFAULT_COUNTRY).toBe('IL')
    expect(phoneToE164('IL', '050-123-4567')).toBe('+972501234567')
    expect(phoneToE164('US', '(201) 555-0123')).toBe('+12015550123')
  })

  it('lets a typed +country prefix win over the selected country', () => {
    expect(phoneToE164('IL', '+44 7400 123456')).toBe('+447400123456')
  })

  it('rejects invalid numbers', () => {
    expect(phoneToE164('IL', '123')).toBeNull()
    expect(phoneToE164('IL', '')).toBeNull()
  })

  it('lists every country once, Israel first', () => {
    const { pinned, rest } = listCountries()
    const all = [...pinned, ...rest]
    expect(pinned[0]).toEqual({ code: 'IL', callingCode: '972', flag: '🇮🇱' })
    expect(new Set(all.map((c) => c.code)).size).toBe(all.length)
  })

  it('names countries in the chosen language', () => {
    expect(countryName('IL', 'en')).toBe('Israel')
    expect(countryName('IL', 'he')).toBe('ישראל')
  })
})

describe('profile', () => {
  it('treats an account without type or phone as unfinished', () => {
    expect(isProfileComplete(null)).toBe(false)
    expect(isProfileComplete({ phone: '', customerType: '' })).toBe(false)
    expect(isProfileComplete({ phone: '+972501234567', customerType: 'student' })).toBe(true)
  })
})
