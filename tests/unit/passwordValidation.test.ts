import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_REQUIREMENT_ITEMS,
  STRONG_PASSWORD_PATTERN,
  isStrongPassword,
  passwordRequirements,
} from '@/lib/auth/passwordValidation'
import PasswordRequirements from '@/components/auth/onboarding/PasswordRequirements'

describe('isStrongPassword', () => {
  it.each(['Abcde1', 'Secret123', 'aB3aB3aB3', 'Pass word 9', 'שלוםAa1', 'Ab1!@#'])('accepts %j', (pw) => {
    expect(isStrongPassword(pw)).toBe(true)
  })

  it.each([
    ['under 6 characters', 'Ab1cd'],
    ['empty', ''],
    ['missing an uppercase letter', 'abcdef1'],
    ['missing a lowercase letter', 'ABCDEF1'],
    ['missing a number', 'Abcdefg'],
    ['Hebrew letters only count toward the length', 'שלוםעולם1'],
  ])('rejects a password %s (%j)', (_why, pw) => {
    expect(isStrongPassword(pw)).toBe(false)
  })

  it('matches the documented pattern exactly', () => {
    expect(STRONG_PASSWORD_PATTERN.source).toBe('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{6,}$')
    expect(MIN_PASSWORD_LENGTH).toBe(6)
  })
})

describe('passwordRequirements', () => {
  it('reports each rule separately', () => {
    expect(passwordRequirements('')).toEqual({ hasMinLength: false, hasUppercase: false, hasLowercase: false, hasNumber: false })
    expect(passwordRequirements('abc')).toEqual({ hasMinLength: false, hasUppercase: false, hasLowercase: true, hasNumber: false })
    expect(passwordRequirements('ABCDEF')).toEqual({ hasMinLength: true, hasUppercase: true, hasLowercase: false, hasNumber: false })
    expect(passwordRequirements('12345')).toEqual({ hasMinLength: false, hasUppercase: false, hasLowercase: false, hasNumber: true })
    expect(passwordRequirements('Abcde1')).toEqual({ hasMinLength: true, hasUppercase: true, hasLowercase: true, hasNumber: true })
  })

  it('agrees with isStrongPassword', () => {
    for (const pw of ['', 'a', 'Ab1', 'abcdef1', 'ABCDEF1', 'Abcdefg', 'Abcde1', 'Zz9 zz', 'Ab1Ab1Ab1']) {
      expect(Object.values(passwordRequirements(pw)).every(Boolean), pw).toBe(isStrongPassword(pw))
    }
  })
})

describe('translations', () => {
  it.each(Object.keys(translations) as Lang[])('has the error and every checklist label (%s)', (lang) => {
    const t = translations[lang]
    expect(t.onb_passwordWeak).toBeTruthy()
    for (const { label } of PASSWORD_REQUIREMENT_ITEMS) expect(t[label], `${lang}.${label}`).toBeTruthy()
    for (const key of ['onb_pwReq_title', 'onb_pwReq_met', 'onb_pwReq_unmet'] as const) expect(t[key]).toBeTruthy()
  })

  it('uses the requested English and Hebrew error text', () => {
    expect(translations.en.onb_passwordWeak).toBe('Password must be at least 6 characters and include an uppercase letter, a lowercase letter, and a number.')
    expect(translations.he.onb_passwordWeak).toBe('הסיסמה חייבת להכיל לפחות 6 תווים, אות גדולה, אות קטנה ומספר.')
  })
})

describe('web checklist', () => {
  function render(password: string, lang: Lang = 'en', visible = true) {
    const t = (key: TranslationKey) => translations[lang][key]
    const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
    return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, createElement(PasswordRequirements, { password, visible })))
  }

  it('is collapsed and takes no space until the field is focused', () => {
    const html = render('', 'en', false)
    const wrapper = html.match(/^<div ([^>]*)>/)![1]
    expect(wrapper).toContain('aria-hidden="true"')
    expect(wrapper).toContain('inert=""')
    expect(wrapper).toContain('grid-rows-[0fr] opacity-0 mt-0 mb-0')
    expect(wrapper).not.toContain('data-open')
    expect(html).toContain('<div class="min-h-0 overflow-hidden">')
  })

  it('opens with a height and opacity transition, instant with reduced motion', () => {
    const wrapper = render('').match(/^<div ([^>]*)>/)![1]
    expect(wrapper).toContain('data-open="true"')
    expect(wrapper).not.toContain('aria-hidden')
    expect(wrapper).not.toContain('inert')
    expect(wrapper).toContain('grid-rows-[1fr] opacity-100 -mt-1.5 mb-5')
    expect(wrapper).toContain('transition-[grid-template-rows,opacity,margin]')
    expect(wrapper).toContain('motion-reduce:transition-none')
  })

  it('shows all four rules, none met before typing', () => {
    const html = render('')
    expect(html.match(/<li /g)).toHaveLength(4)
    expect(html).not.toContain('data-met')
    expect((html.match(/: not yet/g) ?? []).length).toBe(4)
  })

  it('ticks exactly the rules a password meets', () => {
    const html = render('abcdef')
    expect((html.match(/data-met="true"/g) ?? []).length).toBe(2)
    expect(html).toMatch(/data-met="true"[^>]*>.*?At least 6 characters/)
    expect(html).toMatch(/data-met="true"[^>]*>.*?A lowercase letter/)
    expect((render('Abcde1').match(/data-met="true"/g) ?? []).length).toBe(4)
  })

  it('renders in Hebrew with logical spacing only', () => {
    const html = render('A', 'he')
    expect(html).toContain('אות גדולה באנגלית (A–Z)')
    expect(html).toContain('aria-label="הסיסמה צריכה לכלול"')
    expect(html).not.toMatch(/\b(ml|mr|pl|pr|left|right)-/)
  })
})
