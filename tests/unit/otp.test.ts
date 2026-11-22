import { describe, expect, it } from 'vitest'
import { formatOtpCountdown, mergeOtpInput, normalizeOtpInput, OTP_LENGTH, OTP_RESEND_SECONDS } from '@/lib/auth/otp'
import { OTP_RESEND_COOLDOWN_MS } from '@/lib/auth/phoneVerification'

describe('mergeOtpInput', () => {
  it('follows typing, deleting and an autofill (the whole new text)', () => {
    expect(mergeOtpInput('', '4')).toBe('4')
    expect(mergeOtpInput('4', '48')).toBe('48')
    expect(mergeOtpInput('48', '4')).toBe('4')
    expect(mergeOtpInput('48291', '482913')).toBe('482913')
    expect(mergeOtpInput('', '482913')).toBe('482913')
  })

  it('strips spaces, dashes and direction marks from a paste, one digit per box', () => {
    expect(mergeOtpInput('', '482 913')).toBe('482913')
    expect(mergeOtpInput('', '482-913')).toBe('482913')
    expect(mergeOtpInput('', '⁦482⁩ ‏913')).toBe('482913')
    expect(mergeOtpInput('', 'Your GoLandly code is 482 913.')).toBe('482913')
  })

  it('lets a pasted code replace a partial one instead of running into it', () => {
    // The paste lands after the digits already in the field.
    expect(mergeOtpInput('12', '12482 913')).toBe('482913')
    expect(mergeOtpInput('12345', '12345482913')).toBe('482913')
    expect(mergeOtpInput('1', '1482-913')).toBe('482913')
  })

  it('never returns more than six digits', () => {
    expect(mergeOtpInput('', '123456789')).toBe('123456')
    expect(mergeOtpInput('999', '99912345678')).toHaveLength(OTP_LENGTH)
    expect(mergeOtpInput('123456', '1234567')).toBe('123456')
  })

  it('agrees with normalizeOtpInput when nothing is there yet', () => {
    for (const raw of ['123 456', '12-34-56', 'abc', '', '1234567']) expect(mergeOtpInput('', raw)).toBe(normalizeOtpInput(raw))
  })
})

describe('formatOtpCountdown', () => {
  it('shows minutes and seconds', () => {
    expect(formatOtpCountdown(60)).toBe('1:00')
    expect(formatOtpCountdown(59)).toBe('0:59')
    expect(formatOtpCountdown(42)).toBe('0:42')
    expect(formatOtpCountdown(9)).toBe('0:09')
    expect(formatOtpCountdown(0)).toBe('0:00')
  })

  it('rounds a fraction up and never goes negative', () => {
    expect(formatOtpCountdown(41.2)).toBe('0:42')
    expect(formatOtpCountdown(-3)).toBe('0:00')
  })
})

describe('resend cooldown', () => {
  it('is one constant for the client countdown and the server limit', () => {
    expect(OTP_RESEND_SECONDS).toBe(60)
    expect(OTP_RESEND_COOLDOWN_MS).toBe(OTP_RESEND_SECONDS * 1000)
    expect(formatOtpCountdown(OTP_RESEND_SECONDS)).toBe('1:00')
  })
})
