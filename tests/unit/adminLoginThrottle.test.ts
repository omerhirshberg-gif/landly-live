import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryFirestore } from '../helpers/memoryFirestore'

const store = vi.hoisted(() => ({ current: null as unknown as MemoryFirestore }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => store.current.db }))

import { checkAdminPasswordWithRateLimit } from '@/lib/admin/adminAuth'
import { ADMIN_LOGIN_MAX_GLOBAL, ADMIN_LOGIN_MAX_PER_IP } from '@/lib/auth/adminLoginThrottle'
import { issueAdminSessionToken, ADMIN_SESSION_COOKIE } from '@/lib/admin/sessionToken'

const from = (ip: string | null, headers: Record<string, string> = {}) =>
  new Request('https://landly.test/api/admin/verify-password', { method: 'POST', headers: { ...(ip ? { 'x-real-ip': ip } : {}), ...headers } })
const status = async (req: Request, password: string | null = 'wrong') => (await checkAdminPasswordWithRateLimit(req, password))?.status ?? 200

beforeEach(() => {
  store.current = new MemoryFirestore()
  vi.stubEnv('VERCEL', '')
  vi.stubEnv('ADMIN_PASSWORD', 'correct horse')
  vi.stubEnv('ADMIN_SESSION_SECRET', 'test-session-secret')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('admin login throttle off Vercel', () => {
  it('without TRUSTED_IP_HEADER every caller shares one bucket (documented fallback)', async () => {
    for (let i = 0; i < ADMIN_LOGIN_MAX_PER_IP; i++) expect(await status(from(`192.0.2.${i}`))).toBe(401)
    expect(await status(from('198.51.100.1'))).toBe(429)
  })

  it('with TRUSTED_IP_HEADER, one IP exhausting its budget does not lock another', async () => {
    vi.stubEnv('TRUSTED_IP_HEADER', 'x-real-ip')
    for (let i = 0; i < ADMIN_LOGIN_MAX_PER_IP; i++) expect(await status(from('192.0.2.1'))).toBe(401)
    expect(await status(from('192.0.2.1'))).toBe(429)
    expect(await status(from('198.51.100.1'), 'correct horse')).toBe(200)
  })

  it('a client-settable header other than the trusted one cannot mint buckets', async () => {
    vi.stubEnv('TRUSTED_IP_HEADER', 'x-real-ip')
    for (let i = 0; i < ADMIN_LOGIN_MAX_PER_IP; i++) expect(await status(from('192.0.2.1', { 'x-forwarded-for': `203.0.113.${i}` }))).toBe(401)
    expect(await status(from('192.0.2.1', { 'x-forwarded-for': '203.0.113.99' }))).toBe(429)
  })
})

describe('an already signed-in admin', () => {
  const exhaustGlobalBucket = async () => {
    vi.stubEnv('TRUSTED_IP_HEADER', 'x-real-ip')
    for (let i = 0; i < ADMIN_LOGIN_MAX_GLOBAL; i++) await status(from(`10.0.${Math.floor(i / 200)}.${(i % 200) + 1}`))
  }

  it('is not locked out when guessers exhausted the shared buckets, but a stranger is', async () => {
    await exhaustGlobalBucket()
    expect(await status(from('192.0.2.50'), 'correct horse')).toBe(429)
    const cookie = `${ADMIN_SESSION_COOKIE}=${issueAdminSessionToken()}`
    expect(await status(from('192.0.2.50', { cookie }), 'correct horse')).toBe(200)
  })

  it('still has to give the right password, and a bad session buys nothing', async () => {
    await exhaustGlobalBucket()
    const cookie = `${ADMIN_SESSION_COOKIE}=${issueAdminSessionToken()}`
    expect(await status(from('192.0.2.50', { cookie }), 'wrong')).toBe(401)
    expect(await status(from('192.0.2.50', { cookie: `${ADMIN_SESSION_COOKIE}=forged.token` }), 'correct horse')).toBe(429)
  })

  it('a session request does not spend the throttle', async () => {
    vi.stubEnv('TRUSTED_IP_HEADER', 'x-real-ip')
    const cookie = `${ADMIN_SESSION_COOKIE}=${issueAdminSessionToken()}`
    for (let i = 0; i < ADMIN_LOGIN_MAX_PER_IP + 2; i++) expect(await status(from('192.0.2.7', { cookie }), 'wrong')).toBe(401)
    expect(await status(from('192.0.2.7'), 'correct horse')).toBe(200)
  })
})
