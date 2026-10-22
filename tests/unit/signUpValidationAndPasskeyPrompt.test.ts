import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { translations } from '@/lib/i18n/translations'
import { isPasskeyPromptPage, isSnoozed, PASSKEY_PROMPT_SNOOZE_MS } from '@/lib/auth/passkeyPrompt'

const LANGS = Object.keys(translations) as (keyof typeof translations)[]

describe('required-field copy', () => {
  it('says "This field is required" in every language', () => {
    expect(translations.en.form_fieldRequired).toBe('This field is required')
    expect(translations.he.form_fieldRequired).toBe('שדה חובה')
    for (const lang of LANGS) expect(translations[lang].form_fieldRequired, lang).toBeTruthy()
  })
})

describe.each([
  ['web', 'components/auth/entrance/AuthScreen.tsx'],
  ['app', 'landly-mobile/src/app/(auth)/login.tsx'],
])('%s sign-up form', (_, path) => {
  it('can always be submitted, so a missing name is explained instead of greying out the button', async () => {
    const src = await readFile(path, 'utf8')
    expect(src).not.toMatch(/disabled=\{[^}]*firstName\.trim\(\)/)
    expect(src).toContain('signUpFieldErrors({ firstName, lastName, email, password, confirm, agreedToTerms })')
    expect(src).toContain('firstInvalidSignUpField(errors)')
  })

  it('marks both name fields with their own error and shakes them', async () => {
    const src = await readFile(path, 'utf8')
    for (const field of ['firstName', 'lastName']) {
      expect(src).toContain(`error={signUpErrorText('${field}')}`)
      expect(src).toContain(`clearSignUpError('${field}')`)
    }
    expect(src.match(/shake=\{signUpShake\}/g)?.length).toBeGreaterThanOrEqual(5)
  })
})

describe('text fields', () => {
  it('web: ties the error to the input and marks it invalid', async () => {
    const src = await readFile('components/auth/entrance/TextField.tsx', 'utf8')
    expect(src).toContain('aria-invalid={!!error || undefined}')
    expect(src).toContain('aria-describedby={messageId}')
    expect(src).toContain('useShake(boxRef, shake, !!error)')
  })

  it('web: the shake respects reduced motion and composes with the focus zoom', async () => {
    const src = await readFile('lib/useShake.ts', 'utf8')
    expect(src).toContain('prefers-reduced-motion: reduce')
    expect(src).toContain("translate: '-6px 0'")
  })

  it('app: shakes on native and web builds, skipped under reduced motion', async () => {
    const src = await readFile('landly-mobile/src/components/TextField.tsx', 'utf8')
    expect(src).toContain('if (!shake || !error || reduced) return')
    expect(src).toContain('aria-invalid={!!error || undefined}')
  })
})

describe('passkey prompt', () => {
  const now = Date.UTC(2026, 9, 22)

  it('stays away for 30 days after "Not now"', () => {
    expect(isSnoozed(null, now)).toBe(false)
    expect(isSnoozed(String(now - 1000), now)).toBe(true)
    expect(isSnoozed(String(now - PASSKEY_PROMPT_SNOOZE_MS + 1000), now)).toBe(true)
    expect(isSnoozed(String(now - PASSKEY_PROMPT_SNOOZE_MS - 1000), now)).toBe(false)
    expect(isSnoozed('garbage', now)).toBe(false)
  })

  it('shows on member pages, never while signing in, paying or in staff areas', () => {
    for (const page of ['/', '/member', '/perks', '/offers/abc', '/profile']) expect(isPasskeyPromptPage(page), page).toBe(true)
    for (const page of ['/login', '/signup', '/verify-email', '/checkout', '/checkout/success', '/admin/offers', '/business/dashboard']) {
      expect(isPasskeyPromptPage(page), page).toBe(false)
    }
  })

  it('is offered after a password or Google sign-in, never after a passkey one', async () => {
    const src = await readFile('components/auth/entrance/AuthScreen.tsx', 'utf8')
    expect(src.match(/markPasskeyOfferDue\(result\.user\.uid\)/g)).toHaveLength(2)
    expect(src).not.toMatch(/markPasskeyOfferDue\(outcome/)
  })

  it('is mounted once for the whole site', async () => {
    const layout = await readFile('app/layout.tsx', 'utf8')
    expect(layout.match(/<PasskeyPrompt \/>/g)).toHaveLength(1)
  })

  it('has the agreed wording in every language', () => {
    expect(translations.en.passkeyPrompt_title).toBe('Save a passkey for faster sign-in next time')
    expect(translations.he.passkeyPrompt_title).toBe('הפעילו כניסה מהירה עם מפתח גישה (Passkey) לפעם הבאה')
    for (const lang of LANGS) {
      for (const key of ['passkeyPrompt_title', 'passkeyPrompt_body', 'passkeyPrompt_add', 'passkeyPrompt_later', 'passkeyPrompt_close', 'passkeyPrompt_settings'] as const) {
        expect(translations[lang][key], `${lang}.${key}`).toBeTruthy()
      }
    }
  })
})
