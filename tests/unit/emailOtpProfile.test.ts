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
  it('offers "Change" on the email row to password accounts only, outside Edit profile', () => {
    const src = read(profile)
    expect(src).toContain("const canChangeEmail = user.providerData.some((p) => p.providerId === 'password')")
    expect(src).toMatch(/canChangeEmail && !editing && !emailFormOpen &&/)
    expect(src).toMatch(/<ChangeEmailForm[\s\S]*?pendingEmail=\{pendingEmail\}/)
  })

  it('opens the code UI for the address the form sent to, and from the pending notice', () => {
    const src = read(profile)
    expect(src).toMatch(/onSent=\{\(sentTo, resendIn\) => \{[\s\S]*?setOtp\(\{ target: \{ kind: 'email', email: sentTo \}, resendIn \}\)/)
    expect(src).toContain("actionLabel={t('pending_email_enter')}")
    expect(src).toContain("setOtp({ target: { kind: 'email', email: pendingEmail }, resendIn: 0 })")
    expect(src).toMatch(new RegExp(`<${otpTag}[\\s\\S]*?target=\\{otp\\.target\\}`))
    expect(src).not.toContain('resendEmailChange')
  })

  it('refreshes the local Auth record and confirms after an email is verified', () => {
    const src = read(profile)
    expect(src).toContain("if (kind === 'email') user.reload().catch(() => {})")
    expect(src).toContain('otp_email_success')
  })

  it('hands the form result (or the pending address still cooling down) to the code UI', () => {
    const src = read(form)
    expect(src).toContain('onSent(result.pendingEmail, result.resendIn)')
    expect(src).toMatch(/result\.reason === 'rateLimited' && result\.retryAfter && newEmail\.toLowerCase\(\) === pendingEmail/)
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

describe('link flow is gone', () => {
  it('leaves no confirm page, confirm route or link builder behind', () => {
    for (const path of ['app/confirm-email-change/page.tsx', 'app/api/account/verify-email-change/route.ts', 'lib/auth/emailChangeToken.ts']) {
      expect(() => readFileSync(path), path).toThrow()
    }
    expect(read('lib/account/contactChange.ts')).not.toContain('confirmEmailChange')
    expect(read('app/robots.ts')).not.toContain('/confirm-email-change')
  })
})
