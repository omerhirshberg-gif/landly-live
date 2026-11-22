import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The 6-digit code field and its screens, app and website side by side: the
// same behaviour in both, in every language, with the boxes always left-to-right.
const read = (path: string) => readFileSync(path, 'utf8')
const NATIVE = read('landly-mobile/src/components/OtpCodeInput.tsx')
const WEB = read('components/auth/OtpCodeInput.tsx')
const SHEET = read('landly-mobile/src/components/OtpSheet.tsx')
const DIALOG = read('components/profile/OtpDialog.tsx')

describe('OtpCodeInput (app)', () => {
  it('is one TextInput over six boxes, with the numeric keypad and the OS code autofill', () => {
    expect(NATIVE).toContain('keyboardType="number-pad"')
    expect(NATIVE).toContain('textContentType="oneTimeCode"')
    expect(NATIVE).toContain("autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}")
    expect(NATIVE.match(/<TextInput\s/g)).toHaveLength(1)
    expect(NATIVE).toContain('Array.from({ length: OTP_LENGTH }')
    expect(NATIVE).toContain('fontSize: 16')
  })

  it('keeps the boxes left-to-right and out of the screen reader, which meets the one field', () => {
    expect(NATIVE).toContain("direction: 'ltr'")
    expect(NATIVE).toContain('accessibilityElementsHidden')
    expect(NATIVE).toContain('accessibilityLabel={label}')
  })

  it('merges every edit through mergeOtpInput, so a paste with spaces fills one digit per box', () => {
    expect(NATIVE).toContain('onChange(mergeOtpInput(value, raw))')
  })

  it('shakes sideways with the error haptic, and skips the movement under Reduce Motion', () => {
    expect(NATIVE).toContain('translateX')
    expect(NATIVE).toContain('withSequence')
    expect(NATIVE).toContain('useReducedMotion')
    const shake = NATIVE.slice(NATIVE.indexOf('shake: () => {'), NATIVE.indexOf('[offset, reduced]'))
    // The haptic comes first: it is not motion, so Reduce Motion keeps it.
    expect(shake.indexOf('warningHaptic()')).toBeGreaterThan(-1)
    expect(shake.indexOf('warningHaptic()')).toBeLessThan(shake.indexOf('if (reduced) return'))
  })

  it('takes the keyboard back once the field is enabled again, unless the sheet is closing', () => {
    expect(NATIVE).toMatch(/useEffect\(\(\) => \{\s*if \(!disabled && keyboardUp\.current\) inputRef\.current\?\.focus\(\)\s*\}, \[disabled\]\)/)
    expect(NATIVE).toContain('editable={!disabled}')
    expect(NATIVE).toMatch(/blur: \(\) => \{\s*keyboardUp\.current = false/)
  })
})

describe('OtpCodeInput (web)', () => {
  it('is one input over six boxes: numeric, one-time-code autofill, 16px, left-to-right', () => {
    expect(WEB).toContain('inputMode="numeric"')
    expect(WEB).toContain('autoComplete="one-time-code"')
    expect(WEB).toContain('dir="ltr"')
    expect(WEB.match(/<input\b/g)).toHaveLength(1)
    expect(read('app/globals.css')).toMatch(/\.otp-input\{[^}]*font-size:16px/)
    expect(WEB).toContain('aria-label={label}')
    expect(WEB).toContain('aria-hidden="true"')
  })

  it('strips a paste to its digits and replaces the value, and merges every other edit', () => {
    expect(WEB).toContain('onChange(mergeOtpInput(value, e.target.value))')
    expect(WEB).toContain("normalizeOtpInput(e.clipboardData.getData('text'))")
    expect(WEB).toContain('e.preventDefault()')
  })

  it('shakes with a CSS keyframe that Reduce Motion turns off', () => {
    const css = read('app/globals.css')
    expect(css).toMatch(/@keyframes otp-shake\{/)
    expect(css).toMatch(/\.otp-shake\{animation:otp-shake/)
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.otp-shake\{animation:none;\}\}/)
    expect(WEB).toContain('key={shakes}')
  })

  it('refocuses once the input is enabled again, unless the dialog is closing', () => {
    expect(WEB).toMatch(/useEffect\(\(\) => \{\s*if \(!disabled && keyboardUp\.current\) inputRef\.current\?\.focus\(\)\s*\}, \[disabled\]\)/)
    expect(WEB).toMatch(/blur: \(\) => \{\s*keyboardUp\.current = false/)
  })
})

describe.each([
  { name: 'sheet (app)', src: SHEET },
  { name: 'dialog (web)', src: DIALOG },
])('code $name', ({ src }) => {
  it('uses the shared field, one value, and submits on the sixth digit once', () => {
    expect(src).toContain('<OtpCodeInput')
    expect(src).toContain('if (next.length === OTP_LENGTH) verify(next)')
    expect(src).toContain('inFlight.current')
    expect(src).toMatch(/if \(value\.length !== OTP_LENGTH \|\| busy \|\| inFlight\.current\) return/)
  })

  it('shakes and empties the boxes on every failed verify, keeping the inline alert', () => {
    const failed = src.slice(src.indexOf('setBusy(false)\n    setError(failure(result))'))
    expect(failed.slice(0, 200)).toContain("setCode('')")
    expect(failed.slice(0, 260)).toContain('inputRef.current?.shake()')
    expect(src).toMatch(/role="alert"|accessibilityRole="alert"/)
  })

  it('counts the resend down as m:ss, from the one 60 second constant', () => {
    expect(src).toContain("t('otp_resend_in').replace('{time}', formatOtpCountdown(secondsLeft))")
    expect(src).toContain('OTP_RESEND_SECONDS')
    expect(src).toContain('disabled={secondsLeft > 0 || resending || busy}')
  })

  it('confirms a new account with the sign-up routes and the envelope copy', () => {
    expect(src).toContain('verifySignupCode(idToken, value')
    expect(src).toContain('requestSignupOtp(idToken, { lang }')
    expect(src).toContain("signup ? 'otp_signup_title'")
  })

  it('isolates the address left-to-right', () => {
    expect(src).toMatch(/⁦\$\{display\}⁩|<bdi dir="ltr"/)
  })
})

describe('sign-up screens', () => {
  it.each([
    ['app', 'landly-mobile/src/app/(auth)/login.tsx', '<OtpSheet'],
    ['web', 'components/auth/entrance/AuthScreen.tsx', '<OtpDialog'],
  ])('%s: opens the code UI right after sign-up and after an unverified sign-in, never the link card', (_n, path, tag) => {
    const src = read(path)
    expect(src).toContain(tag)
    expect(src).toContain("setPending({ variant: 'signup', email: result.email, idToken: result.idToken, send: result.send })")
    expect(src).toMatch(/setPending\(\{ variant: 'login', email: result\.email, idToken: result\.idToken, send: signupOtpStatus\(result\.idToken, lang/)
    expect(src).not.toContain('VerifyEmail')
    expect(src).toContain('resendIn={OTP_RESEND_SECONDS}')
  })

  it('no longer sends the verification link from the sign-up path', () => {
    expect(read('lib/auth/signUpCustomer.ts')).toContain('requestSignupOtp(')
    expect(read('lib/auth/signUpCustomer.ts')).not.toContain('send-verification')
    // The old link route and page stay for emails already sent.
    expect(() => readFileSync('app/api/auth/send-verification/route.ts')).not.toThrow()
    expect(() => readFileSync('app/verify-email/page.tsx')).not.toThrow()
  })
})
