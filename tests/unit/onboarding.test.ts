import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COUNTRY,
  countryName,
  fullName,
  greetingName,
  isOnboardingComplete,
  isPlausibleEmail,
  listCountries,
  normalizePersonName,
  onboardingDraftKey,
  parseOnboardingDraft,
  personaNote,
  serializeOnboardingDraft,
  ONBOARDING_LANGS,
  ONBOARDING_STEPS,
  nextStep,
  passwordStrength,
  phoneToE164,
  prevStep,
  signUpFormError,
  splitDisplayName,
  onboardingProgress,
} from '@/lib/auth/onboarding'
import { CUSTOMER_TYPES } from '@/lib/customerTypes'
import { translations } from '@/lib/i18n/translations'

describe('step order', () => {
  it('runs welcome, the four questions and the celebration, with no credentials among them', () => {
    expect(ONBOARDING_STEPS).toEqual(['welcome', 'language', 'persona', 'phone', 'notifications', 'done'])
  })

  it('moves forward and back between neighbours only', () => {
    expect(nextStep('welcome')).toBe('language')
    expect(nextStep('language')).toBe('persona')
    expect(nextStep('notifications')).toBe('done')
    expect(nextStep('done')).toBeNull()
    expect(prevStep('phone')).toBe('persona')
    expect(prevStep('language')).toBe('welcome')
    expect(prevStep('welcome')).toBeNull()
  })

  it('never goes back from the celebration (the answers are saved by then)', () => {
    expect(prevStep('done')).toBeNull()
  })

  it('offers every app language, Hebrew strictly last', () => {
    expect(ONBOARDING_LANGS.map((l) => l.code)).toEqual(['en', 'ru', 'fr', 'es', 'he'])
    expect(new Set(ONBOARDING_LANGS.map((l) => l.code))).toEqual(new Set(Object.keys(translations)))
  })

  it('reports progress continuously from the welcome (empty) to the celebration (full)', () => {
    expect(ONBOARDING_STEPS.map(onboardingProgress)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1])
  })

  it('lists the personas in the spec order', () => {
    expect(CUSTOMER_TYPES.map((c) => c.value)).toEqual(['student', 'new_immigrant', 'taglit', 'long_term_program', 'traveler', 'other'])
  })
})

describe('names and greeting', () => {
  it('normalizes a typed name', () => {
    expect(normalizePersonName('  Dana \n  Levi\u0007 ')).toBe('Dana Levi')
    expect(normalizePersonName(42)).toBe('')
    expect(normalizePersonName('x'.repeat(80))).toHaveLength(50)
  })

  it('joins first and last name with a space', () => {
    expect(fullName('Amit', 'Bar David')).toBe('Amit Bar David')
    expect(fullName(' Amit ', '')).toBe('Amit')
  })

  it('splits a display name into first and last', () => {
    expect(splitDisplayName('Amit Bar David')).toEqual({ firstName: 'Amit', lastName: 'Bar David' })
    expect(splitDisplayName(null)).toEqual({ firstName: '', lastName: '' })
  })

  it('greets by first name, then display name, and never by the email', () => {
    expect(greetingName({ firstName: 'Amit', displayName: 'Someone Else' }, 'Auth Name')).toBe('Amit')
    expect(greetingName({ firstName: '', displayName: 'Dana Levi' }, null)).toBe('Dana')
    expect(greetingName(null, 'Noa Cohen')).toBe('Noa')
    expect(greetingName({ firstName: '', displayName: '' }, 'bardavid.amit@example.com')).toBeNull()
    expect(greetingName(null, null)).toBeNull()
  })
})

describe('persona note', () => {
  it('is kept only for Other, trimmed and capped', () => {
    expect(personaNote('other', '  Volunteer   year ')).toBe('Volunteer year')
    expect(personaNote('student', 'ignored')).toBe('')
    expect(personaNote('other', '')).toBe('')
    expect(personaNote('other', 'x'.repeat(200))).toHaveLength(120)
  })
})

describe('identity and password', () => {
  it('accepts plausible emails and rejects obvious typos', () => {
    expect(isPlausibleEmail(' dana@example.co.il ')).toBe(true)
    expect(isPlausibleEmail('dana@example')).toBe(false)
    expect(isPlausibleEmail('dana example.com')).toBe(false)
  })

  it('checks the Sign Up form in field order: names, email, length, then the confirmation', () => {
    const ok = { firstName: 'Dana', lastName: 'Levi', email: 'dana@example.com', password: 'secret1', confirm: 'secret1' }
    expect(signUpFormError({ ...ok, firstName: '  ' })).toBe('onb_firstNameRequired')
    expect(signUpFormError({ ...ok, lastName: '' })).toBe('onb_lastNameRequired')
    expect(signUpFormError({ ...ok, email: 'dana@example' })).toBe('onb_emailInvalid')
    expect(signUpFormError({ ...ok, password: 'abc', confirm: 'abc' })).toBe('onb_passwordTooShort')
    expect(signUpFormError({ ...ok, confirm: 'secret2' })).toBe('onb_passwordMismatch')
    expect(signUpFormError(ok)).toBeNull()
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
  it('treats an account that never finished onboarding as unfinished', () => {
    expect(isOnboardingComplete(null)).toBe(false)
    expect(isOnboardingComplete({ phone: '', customerType: '', onboardingCompleted: false })).toBe(false)
    expect(isOnboardingComplete({ phone: '', customerType: 'student', onboardingCompleted: false })).toBe(false)
  })

  it('counts a finished wizard even when the WhatsApp number was skipped', () => {
    expect(isOnboardingComplete({ phone: '', customerType: 'student', onboardingCompleted: true })).toBe(true)
  })

  it('keeps members from before the completion flag out of the wizard', () => {
    expect(isOnboardingComplete({ phone: '+972501234567', customerType: 'student' })).toBe(true)
  })
})

describe('translations', () => {
  it('has every new onboarding string in all five languages', () => {
    const keys = Object.keys(translations.en).filter((k) => k.startsWith('onb_') || k.startsWith('home_welcome'))
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) {
      for (const key of keys) expect(translations[lang][key as keyof typeof translations.en], `${lang}.${key}`).toBeTruthy()
    }
    expect(translations.he.onb_done_cta).toContain('בוא נתחיל לחקור')
  })
})

describe('onboarding draft', () => {
  const draft = {
    step: 'phone',
    customerType: 'student',
    customerTypeOther: '',
    country: 'IL',
    phone: '50 123 4567',
    phoneSkipped: false,
  } as const

  it('round-trips the card and the answers', () => {
    expect(parseOnboardingDraft(serializeOnboardingDraft(draft))).toEqual(draft)
  })

  it('keeps one draft per member', () => {
    expect(onboardingDraftKey('a')).not.toBe(onboardingDraftKey('b'))
  })

  it('has nothing to resume without a stored draft', () => {
    expect(parseOnboardingDraft(null)).toBeNull()
    expect(parseOnboardingDraft(undefined)).toBeNull()
    expect(parseOnboardingDraft('')).toBeNull()
  })

  it('drops corrupt or foreign data', () => {
    expect(parseOnboardingDraft('{not json')).toBeNull()
    expect(parseOnboardingDraft('null')).toBeNull()
    expect(parseOnboardingDraft('"phone"')).toBeNull()
    expect(parseOnboardingDraft(JSON.stringify({ ...draft, step: 'password' }))).toBeNull()
    expect(parseOnboardingDraft(JSON.stringify({ ...draft, country: 'XX' }))).toBeNull()
    expect(parseOnboardingDraft(JSON.stringify({ ...draft, phoneSkipped: 'no' }))).toBeNull()
    expect(parseOnboardingDraft(JSON.stringify({ ...draft, phone: 42 }))).toBeNull()
    expect(parseOnboardingDraft(JSON.stringify({ ...draft, customerTypeOther: 'x'.repeat(500) }))).toBeNull()
  })

  it('never resumes on the celebration, which only follows a save', () => {
    expect(parseOnboardingDraft(JSON.stringify({ ...draft, step: 'done' }))).toBeNull()
  })

  it('resumes on any question card', () => {
    for (const step of ONBOARDING_STEPS.filter((s) => s !== 'done')) {
      expect(parseOnboardingDraft(JSON.stringify({ ...draft, step }))?.step).toBe(step)
    }
  })
})

describe('desktop brand panel copy', () => {
  it('exists in every language', () => {
    const keys = Object.keys(translations.en).filter((k) => k.startsWith('auth_panel_') || k.startsWith('onb_panel_') || k.startsWith('onb_step_'))
    expect(keys.length).toBeGreaterThan(15)
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) {
      for (const key of keys) expect(translations[lang][key as keyof typeof translations.en], `${lang}.${key}`).toBeTruthy()
    }
  })
})
