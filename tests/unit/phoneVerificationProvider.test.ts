import { afterEach, describe, expect, it, vi } from 'vitest'
import { devProvider, otpProvider, phoneVerificationMode } from '@/lib/auth/phoneVerification'

// Which provider runs where, and the production on/off flag. The 019
// gateway itself is covered by gateway019.test.ts.

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('PHONE_VERIFICATION_ENABLED', () => {
  const configure019 = () => {
    vi.stubEnv('SMS_019_USERNAME', 'landly')
    vi.stubEnv('SMS_019_PASSWORD', 'secret')
    vi.stubEnv('SMS_019_SENDER', 'GoLandly')
  }

  it('turns verification on in production, and wins over the old flag', () => {
    vi.stubEnv('NODE_ENV', 'production')
    configure019()
    expect(phoneVerificationMode()).toBe('direct')
    vi.stubEnv('PHONE_VERIFICATION_ENABLED', 'true')
    // 019's endpoints are not filled in yet, so even complete credentials keep saving directly.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(phoneVerificationMode()).toBe('direct')
  })

  it('turns verification off in development when set to false', () => {
    vi.stubEnv('PHONE_VERIFICATION_ENABLED', 'false')
    expect(phoneVerificationMode()).toBe('direct')
  })

  it('verifies in development by default, through the simulator', () => {
    expect(phoneVerificationMode()).toBe('otp')
    expect(otpProvider()).toBe(devProvider)
  })
})
