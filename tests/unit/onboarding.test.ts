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
  phoneToE164,
  prevStep,
  firstInvalidSignUpField,
  nameFieldErrors,
  signUpFieldErrors,
  splitDisplayName,
  onboardingProgress,
} from '@/lib/auth/onboarding'
import { CUSTOMER_TYPES } from '@/lib/customerTypes'
import { translations } from '@/lib/i18n/translations'

describe('step order', () => {
  it('runs welcome, the five questions and the celebration, with no credentials among them', () => {
    expect(ONBOARDING_STEPS).toEqual(['welcome', 'language', 'persona', 'origin', 'phone', 'notifications', 'done'])
  })

  it('moves forward and back between neighbours only', () => {
    expect(nextStep('welcome')).toBe('language')
    expect(nextStep('language')).toBe('persona')
    expect(nextStep('notifications')).toBe('done')
    expect(nextStep('done')).toBeNull()
    expect(nextStep('persona')).toBe('origin')
    expect(nextStep('origin')).toBe('phone')
    expect(prevStep('phone')).toBe('origin')
    expect(prevStep('origin')).toBe('persona')
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
    expect(ONBOARDING_STEPS.map(onboardingProgress)).toEqual([0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1])
  })

  it('lists the personas in the spec order', () => {
    expect(CUSTOMER_TYPES.map((c) => c.value)).toEqual(['student', 'new_immigrant', 'lone_soldier', 'taglit', 'long_term_program', 'traveler', 'other'])
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

  it('checks every Sign Up field at once: blank fields are required, filled ones get their own rule', () => {
    const ok = { firstName: 'Dana', lastName: 'Levi', email: 'dana@example.com', password: 'Secret1', confirm: 'Secret1', agreedToTerms: true }
    expect(signUpFieldErrors(ok)).toEqual({})
    expect(signUpFieldErrors({ ...ok, firstName: '  ', lastName: '' })).toEqual({ firstName: 'form_fieldRequired', lastName: 'form_fieldRequired' })
    expect(signUpFieldErrors({ ...ok, email: 'dana@example' })).toEqual({ email: 'onb_emailInvalid' })
    expect(signUpFieldErrors({ ...ok, password: 'Ab1', confirm: 'Ab1' })).toEqual({ password: 'onb_passwordWeak' })
    expect(signUpFieldErrors({ ...ok, password: 'secret1', confirm: 'secret1' })).toEqual({ password: 'onb_passwordWeak' })
    expect(signUpFieldErrors({ ...ok, confirm: 'Secret2' })).toEqual({ confirm: 'onb_passwordMismatch' })
    expect(signUpFieldErrors({ ...ok, agreedToTerms: false })).toEqual({ terms: 'signup_termsRequired' })
    expect(signUpFieldErrors({ firstName: '', lastName: '', email: '', password: '', confirm: '', agreedToTerms: false })).toEqual({
      firstName: 'form_fieldRequired',
      lastName: 'form_fieldRequired',
      email: 'form_fieldRequired',
      password: 'form_fieldRequired',
      confirm: 'form_fieldRequired',
      terms: 'signup_termsRequired',
    })
  })

  it('focuses the first invalid field in screen order', () => {
    expect(firstInvalidSignUpField({ terms: 'signup_termsRequired', lastName: 'form_fieldRequired', email: 'onb_emailInvalid' })).toBe('lastName')
    expect(firstInvalidSignUpField({ terms: 'signup_termsRequired' })).toBe('terms')
    expect(firstInvalidSignUpField({})).toBeNull()
  })

  it('requires both names in the profile editors too', () => {
    expect(nameFieldErrors({ firstName: 'Dana', lastName: 'Levi' })).toEqual({})
    expect(nameFieldErrors({ firstName: ' \t ', lastName: 'Levi' })).toEqual({ firstName: 'form_fieldRequired' })
    expect(nameFieldErrors({ firstName: '', lastName: '' })).toEqual({ firstName: 'form_fieldRequired', lastName: 'form_fieldRequired' })
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
    countryOfOrigin: 'FR',
    country: 'IL',
    phone: '50 123 4567',
    phoneSkipped: false,
  } as const

  it('round-trips the card and the answers', () => {
    expect(parseOnboardingDraft(serializeOnboardingDraft(draft))).toEqual(draft)
  })

  it('resumes a draft saved before the origin card with the origin unanswered', () => {
    const { countryOfOrigin: _omitted, ...older } = draft
    expect(parseOnboardingDraft(JSON.stringify(older))).toEqual({ ...draft, countryOfOrigin: '' })
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
    expect(parseOnboardingDraft(JSON.stringify({ ...draft, countryOfOrigin: 'XX' }))).toBeNull()
    expect(parseOnboardingDraft(JSON.stringify({ ...draft, countryOfOrigin: 7 }))).toBeNull()
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
