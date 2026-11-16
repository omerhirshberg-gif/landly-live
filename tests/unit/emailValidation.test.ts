import { describe, expect, it } from 'vitest'
import { emailDomain, isValidEmail, normalizeEmail } from '@/lib/validation/email'
import { suggestEmail } from '@/lib/validation/emailTypo'

describe('shared email validation', () => {
  it.each(['a@b.co', 'noa@example.com', 'name+tag@mail.example.co.il', 'x@startup.tech', 'x@shop.online', 'user@xn--hxajbheg2az3al.xn--jxalpdlp', 'a.b_c-d@sub.domain.org'])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true)
  })
  it.each(['', 'a@b', 'a@b.c', 'a b@c.co', '@c.co', 'a@@c.co', 'a@c..co', 'a@-c.co', 'a@c.co,d@e.co', 'a<b>@c.co', 'a@c.co\nBcc: x@y.co', 'no-at.com'])('rejects %j', (email) => {
    expect(isValidEmail(email)).toBe(false)
  })
  it('rejects an address over 254 characters', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@b.co`)).toBe(false)
  })
  it('normalizes: trimmed and lowercased, or null', () => {
    expect(normalizeEmail('  Noa@Example.COM ')).toBe('noa@example.com')
    expect(normalizeEmail('nope')).toBeNull()
    expect(normalizeEmail(5)).toBeNull()
  })
  it('reads the domain', () => {
    expect(emailDomain('A@Icloud.com')).toBe('icloud.com')
    expect(emailDomain('nothing')).toBe('')
  })
})

describe('email typo suggestions', () => {
  it.each([
    ['sysprof@icloiud.com', 'sysprof@icloud.com'],
    ['a@gamil.com', 'a@gmail.com'],
    ['a@gmial.com', 'a@gmail.com'],
    ['a@gnail.com', 'a@gmail.com'],
    ['a@hotnail.com', 'a@hotmail.com'],
    ['a@yaho.com', 'a@yahoo.com'],
    ['a@outlok.com', 'a@outlook.com'],
    ['a@wala.co.il', 'a@walla.co.il'],
    ['a@gmail.con', 'a@gmail.com'],
    ['  A.B@GMAIL.CO ', 'A.B@gmail.com'],
  ])('%s -> %s', (input, expected) => {
    expect(suggestEmail(input)?.email).toBe(expected)
  })
  it('catches a one-edit slip not in the table', () => {
    expect(suggestEmail('a@gmaiil.com')?.email).toBe('a@gmail.com')
    expect(suggestEmail('a@hotmaail.com')?.email).toBe('a@hotmail.com')
  })
  it.each(['a@gmail.com', 'a@icloud.com', 'a@walla.co.il', 'a@gmx.com', 'a@example.com', 'a@company.co.il', 'a@me.com', 'a@aol.com', 'a@msn.org', 'plain', 'a@', '@gmail.com'])('leaves %s alone', (email) => {
    expect(suggestEmail(email)).toBeNull()
  })
  it('only touches the domain', () => {
    expect(suggestEmail('gmial@icloiud.com')?.email).toBe('gmial@icloud.com')
  })
})

describe('typo hint copy', () => {
  it('exists in every site language and every /join language with the {email} placeholder', async () => {
    const { translations } = await import('@/lib/i18n/translations')
    const { PRELAUNCH_COPY } = await import('@/lib/prelaunch/copy')
    for (const lang of ['en', 'he', 'ru', 'fr', 'es'] as const) {
      expect(translations[lang].email_didYouMean).toContain('{email}')
      expect(translations[lang].email_useSuggestion).toBeTruthy()
      expect(translations[lang].email_domainInvalid).toBeTruthy()
      expect(translations[lang].contact_err_invalidEmailDomain).toBeTruthy()
      expect(PRELAUNCH_COPY[lang].emailDidYouMean).toContain('{email}')
      expect(PRELAUNCH_COPY[lang].emailUseSuggestion).toBeTruthy()
      expect(PRELAUNCH_COPY[lang].errEmailDomain).toBeTruthy()
    }
  })
})
