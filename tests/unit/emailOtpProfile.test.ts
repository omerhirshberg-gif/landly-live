import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The email change uses a 6-digit code on both platforms, through the same
// dialog (web) and sheet (app) as a phone change.
const read = (path: string) => readFileSync(path, 'utf8')

const SCREENS = [
  { name: 'web', profile: 'components/profile/ProfileSection.tsx', form: 'components/profile/ChangeEmailForm.tsx', otp: 'components/profile/OtpDialog.tsx', otpTag: 'OtpDialog' },
  { name: 'app', profile: 'landly-mobile/src/app/(tabs)/profile.tsx', form: 'landly-mobile/src/components/ChangeEmailForm.tsx', otp: 'landly-mobile/src/components/OtpSheet.tsx', otpTag: 'OtpSheet' },
]

describe.each(SCREENS)('email change by code ($name)', ({ profile, form, otp, otpTag }) => {
  it('offers "Change" only inside Edit profile, to password accounts, and locks a Google address', () => {
    const src = read(profile)
    expect(src).toContain("const googleAccount = user.providerData.some((p) => p.providerId === 'google.com')")
    // Google linked locks it even beside a password.
    expect(src).toContain("const canChangeEmail = !googleAccount && user.providerData.some((p) => p.providerId === 'password')")
    // No entry point outside Edit profile any more.
    expect(src).not.toMatch(/canChangeEmail && !editing/)
    expect(src).toMatch(/\{editing \? \(?\s*(\/\/[^\n]*\n\s*)?(emailBox|<View style=\{\[styles\.emailBox)/)
    expect(src).toMatch(/canChangeEmail \? \(\s*!emailFormOpen &&/)
    expect(src).toMatch(/canChangeEmail && emailFormOpen && editing &&/)
    expect(src).toMatch(/editing && !canChangeEmail && googleAccount &&[\s\S]{0,80}t\('profile_email_google_locked'\)/)
    expect(src).toMatch(/<ChangeEmailForm[\s\S]*?pendingEmail=\{pendingEmail\}/)
  })

  it('closes the email form when Edit profile is cancelled or saved', () => {
    const src = read(profile)
    expect(src.match(/setEditing\(false\)\s*\n\s*setEmailFormOpen\(false\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('opens the code UI for the address the form sent to, and from the pending notice', () => {
    const src = read(profile)
    expect(src).toMatch(/onSent=\{\(sentTo, resendIn\) => \{[\s\S]*?setOtp\(\{ target: \{ kind: 'email', email: sentTo \}, resendIn \}\)/)
    expect(src).toContain("actionLabel={t('pending_email_enter')}")
    expect(src).toContain("setOtp({ target: { kind: 'email', email: pendingEmail }, resendIn: 0 })")
    expect(src).toMatch(new RegExp(`<${otpTag}[\\s\\S]*?target=\\{otp\\.target\\}`))
    expect(src).not.toContain('resendEmailChange')
  })

  it('signs this device back in (every session ended) before confirming a verified email', () => {
    const code = read(otp)
    expect(code).toContain("if (isEmail) await finishEmailChange(auth, user, 'customToken' in result ? result.customToken : undefined).catch(() => {})")
    // The sign-in finishes before the screen hears about it.
    expect(code.indexOf('await finishEmailChange(')).toBeLessThan(code.indexOf('onVerified', code.indexOf('await finishEmailChange(')))
    const src = read(profile)
    expect(src).not.toContain('user.reload()')
    expect(src).toContain(otpTag === 'OtpDialog' ? 'otp_email_success' : "'emailVerified'")
  })

  it('hands the form result (or the pending address still cooling down) to the code UI', () => {
    const src = read(form)
    expect(src).toContain('onSent(result.pendingEmail, result.resendIn)')
    expect(src).toMatch(/result\.reason === 'rateLimited' && result\.retryAfter && newEmail\.toLowerCase\(\) === pendingEmail/)
    // Its failures read as email failures ("…change your email again"), not phone ones.
    expect(src).toContain("setError(t(contactChangeErrorKey(result.reason, 'email')))")
  })

  it('verifies and resends by target, with the email-specific copy', () => {
    const src = read(otp)
    expect(src).toContain('verifyEmailCode(idToken, value')
    expect(src).toContain('resendEmailChange(idToken, lang')
    expect(src).toContain("contactChangeErrorKey(result.reason, target.kind)")
    expect(src).toContain("isEmail ? 'otp_email_title' : 'otp_title'")
    expect(src).toContain("isEmail ? 'otp_email_subtitle' : 'otp_subtitle'")
  })
})

describe('web profile form structure', () => {
  // ChangeEmailForm is its own <form>; it must never render inside the edit form.
  it('keeps the name and email rows above the Edit profile form', () => {
    const src = read('components/profile/ProfileSection.tsx')
    const identity = src.slice(src.indexOf('const identity = ('), src.indexOf('const details = ('))
    expect(identity).toContain('{emailRow}')
    expect(src.slice(src.indexOf('const details = ('))).not.toContain('{emailRow}')
    expect(src).toMatch(/\{identity\}\s*\{editing \? \(\s*<form onSubmit=\{handleSave\}/)
  })

  it('isolates the address as LTR in the Edit profile box', () => {
    const src = read('components/profile/ProfileSection.tsx')
    expect(src).toMatch(/const emailBox = \([\s\S]*?<bdi dir="ltr">\{email\}<\/bdi>/)
    expect(read('landly-mobile/src/app/(tabs)/profile.tsx')).toContain('<AppText ltr style={styles.emailBoxValue}>{email}</AppText>')
  })
})

describe('link flow is gone', () => {
  it('leaves no confirm page, confirm route or link builder behind', () => {
    for (const path of ['app/confirm-email-change/page.tsx', 'app/api/account/verify-email-change/route.ts', 'lib/auth/emailChangeToken.ts']) {
      expect(() => readFileSync(path), path).toThrow()
    }
    expect(read('lib/account/contactChange.ts')).not.toContain('confirmEmailChange')
    expect(read('app/robots.ts')).not.toContain('/confirm-email-change')
  })
})
