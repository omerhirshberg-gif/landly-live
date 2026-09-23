import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FirebaseError } from 'firebase/app'
import { clientIp } from '@/lib/auth/clientIp'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'

const request = (headers: Record<string, string> = {}) => new Request('https://test.invalid', { headers })
beforeEach(() => { vi.resetModules(); vi.stubEnv('VERCEL', '1'); vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('trusted ingress IP', () => {
  it('ignores ordinary forwarded headers and trusts only the platform header on Vercel', () => {
    expect(clientIp(request({ 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '1.2.3.4' }))).toBe('unknown')
    const req = request({ 'x-vercel-forwarded-for': '192.0.2.1', 'x-forwarded-for': '1.2.3.4' })
    expect(clientIp(req)).toBe('192.0.2.1')
    vi.stubEnv('VERCEL', '')
    expect(clientIp(req)).toBe('unknown')
  })
  it.each(['garbage', '1.2.3.4, 5.6.7.8', '1.2.3.4:123', '[::1]', 'fe80::1%eth0', '999.1.2.3', ''])('rejects malformed or ambiguous address %s', (value) => {
    expect(clientIp(request({ 'x-vercel-forwarded-for': value }))).toBe('unknown')
  })
  it('normalizes equivalent IPv6 and IPv4-mapped addresses', () => {
    expect(clientIp(request({ 'x-vercel-forwarded-for': '2001:0DB8:0000:0:0:0:0:1' }))).toBe('2001:db8::1')
    expect(clientIp(request({ 'x-vercel-forwarded-for': '::ffff:192.0.2.1' }))).toBe('192.0.2.1')
  })
})

it('rotating spoofed headers cannot bypass any IP limiter', async () => {
  const { isPasswordResetRateLimited } = await import('@/lib/auth/passwordResetRateLimit')
  const { isVerificationIpRateLimited } = await import('@/lib/auth/verificationRateLimit')
  const { checkAdminPasswordWithRateLimit } = await import('@/lib/admin/adminAuth')
  for (let i = 0; i < 11; i++) {
    const req = request({ 'x-forwarded-for': `192.0.2.${i}` })
    expect(isPasswordResetRateLimited(req)).toBe(i >= 5)
    expect(isVerificationIpRateLimited(req)).toBe(i >= 10)
    expect(checkAdminPasswordWithRateLimit(req, null)?.status).toBe(i >= 10 ? 429 : 401)
  }
})

it('UID budgets isolate accounts and scopes, reject excess calls, and expire', async () => {
  const { checkUidRateLimit } = await import('@/lib/auth/uidRateLimit')
  for (let i = 0; i < 10; i++) expect(checkUidRateLimit('payment', 'a')).toBeNull()
  expect(checkUidRateLimit('payment', 'a')?.status).toBe(429)
  expect(checkUidRateLimit('payment', 'a')?.headers.get('Retry-After')).toBe('60')
  expect(checkUidRateLimit('payment', 'b')).toBeNull()
  for (let i = 0; i < 60; i++) expect(checkUidRateLimit('business', 'a')).toBeNull()
  expect(checkUidRateLimit('business', 'a')?.status).toBe(429)
  vi.advanceTimersByTime(60000)
  expect(checkUidRateLimit('payment', 'a')).toBeNull()
  expect(checkUidRateLimit('business', 'a')).toBeNull()
})

it('signup does not confirm account existence and offers recovery guidance', () => {
  const message = getAuthErrorMessage(new FirebaseError('auth/email-already-in-use', 'EMAIL_EXISTS'))
  expect(message).not.toMatch(/already|exists|registered|EMAIL_EXISTS/i)
  expect(message).toMatch(/signing in or resetting your password/)
})
