import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FirebaseError } from 'firebase/app'
import { clientIp } from '@/lib/auth/clientIp'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'
import { MemoryFirestore } from '../helpers/memoryFirestore'

// The admin login throttle lives in Firestore (lib/auth/adminLoginThrottle.ts).
const store = vi.hoisted(() => ({ current: null as unknown as MemoryFirestore }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => store.current.db }))

const request = (headers: Record<string, string> = {}) => new Request('https://test.invalid', { headers })
beforeEach(() => { vi.resetModules(); vi.stubEnv('VERCEL', '1'); vi.useFakeTimers(); store.current = new MemoryFirestore() })
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
    expect(await isPasswordResetRateLimited(req)).toBe(i >= 5)
    expect(await isVerificationIpRateLimited(req)).toBe(i >= 10)
    expect((await checkAdminPasswordWithRateLimit(req, null))?.status).toBe(i >= 10 ? 429 : 401)
  }
})

it('UID budgets isolate accounts and scopes, reject excess calls, and expire', async () => {
  const { checkUidRateLimit } = await import('@/lib/auth/uidRateLimit')
  for (let i = 0; i < 10; i++) expect(await checkUidRateLimit('payment', 'a')).toBeNull()
  expect((await checkUidRateLimit('payment', 'a'))?.status).toBe(429)
  expect((await checkUidRateLimit('payment', 'a'))?.headers.get('Retry-After')).toBe('60')
  expect(await checkUidRateLimit('payment', 'b')).toBeNull()
  for (let i = 0; i < 60; i++) expect(await checkUidRateLimit('business', 'a')).toBeNull()
  expect((await checkUidRateLimit('business', 'a'))?.status).toBe(429)
  vi.advanceTimersByTime(60000)
  expect(await checkUidRateLimit('payment', 'a')).toBeNull()
  expect(await checkUidRateLimit('business', 'a')).toBeNull()
})

it('signup does not confirm account existence and offers recovery guidance', () => {
  const message = getAuthErrorMessage(new FirebaseError('auth/email-already-in-use', 'EMAIL_EXISTS'))
  expect(message).not.toMatch(/already|exists|registered|EMAIL_EXISTS/i)
  expect(message).toMatch(/signing in or resetting your password/)
})

describe('durable (Firestore) rate limits', () => {
  it('survive a cold start: a fresh instance with empty memory still refuses an exhausted budget', async () => {
    const first = await import('@/lib/auth/uidRateLimit')
    for (let i = 0; i < 10; i++) expect(await first.checkUidRateLimit('payment', 'cold')).toBeNull()
    vi.resetModules() // a new serverless instance: every in-memory map is empty
    const second = await import('@/lib/auth/uidRateLimit')
    expect((await second.checkUidRateLimit('payment', 'cold'))?.status).toBe(429)
    expect(await second.checkUidRateLimit('payment', 'other')).toBeNull()
  })
  it('apply to password reset and verification mail across instances, and expire with the window', async () => {
    const req = request({ 'x-vercel-forwarded-for': '198.51.100.7' })
    const a = await import('@/lib/auth/passwordResetRateLimit')
    for (let i = 0; i < 5; i++) expect(await a.isPasswordResetRateLimited(req)).toBe(false)
    vi.resetModules()
    const b = await import('@/lib/auth/passwordResetRateLimit')
    expect(await b.isPasswordResetRateLimited(req)).toBe(true)
    vi.advanceTimersByTime(15 * 60 * 1000 + 1)
    vi.resetModules()
    const c = await import('@/lib/auth/passwordResetRateLimit')
    expect(await c.isPasswordResetRateLimited(req)).toBe(false)
  })
  it('write nothing once the budget is spent, and never store the raw key', async () => {
    const { isDurablyLimited } = await import('@/lib/auth/durableRateLimit.server')
    const limit = { scope: 'unit', key: 'user@example.com', max: 2, windowMs: 60_000 }
    expect(await isDurablyLimited(limit)).toBe(false)
    expect(await isDurablyLimited(limit)).toBe(false)
    const docs = store.current.list('rateLimits')
    expect(Object.keys(docs)).toHaveLength(1)
    expect(Object.keys(docs)[0]).not.toContain('example')
    const before = JSON.stringify(docs)
    expect(await isDurablyLimited(limit)).toBe(true)
    expect(JSON.stringify(store.current.list('rateLimits'))).toBe(before)
    expect(Object.values(docs)[0]).toMatchObject({ count: 2 })
  })
  it('fail open when Firestore is unavailable, leaving the in-memory limit in charge', async () => {
    const { isDurablyLimited } = await import('@/lib/auth/durableRateLimit.server')
    store.current.db.runTransaction = (() => Promise.reject(new Error('unavailable'))) as never
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await isDurablyLimited({ scope: 'unit', key: 'k', max: 1, windowMs: 1000 })).toBe(false)
    spy.mockRestore()
  })
})
