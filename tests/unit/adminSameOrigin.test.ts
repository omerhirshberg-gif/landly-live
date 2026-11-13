import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { ADMIN_SESSION_COOKIE, issueAdminSessionToken } from '@/lib/admin/sessionToken'

// A cookie-authenticated write must come from this host. x-forwarded-host is
// honoured only where Vercel's ingress overwrites it.
const write = (headers: Record<string, string>) => new Request('https://landly.test/api/admin/x', {
  method: 'POST',
  headers: { cookie: `${ADMIN_SESSION_COOKIE}=${issueAdminSessionToken()}`, ...headers },
})

beforeEach(() => {
  vi.stubEnv('ADMIN_SESSION_SECRET', 'test-session-secret')
  vi.stubEnv('VERCEL', '')
})
afterEach(() => vi.unstubAllEnvs())

describe('admin same-origin check', () => {
  it('off Vercel, a forged x-forwarded-host cannot make a foreign Origin pass', () => {
    const res = requireAdminAuth(write({ origin: 'https://evil.test', 'x-forwarded-host': 'evil.test' }))
    expect(res?.status).toBe(403)
  })

  it('off Vercel, the real host still passes', () => {
    expect(requireAdminAuth(write({ origin: 'https://landly.test', 'x-forwarded-host': 'evil.test' }))).toBeNull()
  })

  it('on Vercel, x-forwarded-host is honoured (the ingress sets it)', () => {
    vi.stubEnv('VERCEL', '1')
    expect(requireAdminAuth(write({ origin: 'https://app.landly.test', 'x-forwarded-host': 'app.landly.test' }))).toBeNull()
    expect(requireAdminAuth(write({ origin: 'https://evil.test', 'x-forwarded-host': 'app.landly.test' }))?.status).toBe(403)
  })

  it('refuses a write with no Origin, and lets safe methods through', () => {
    expect(requireAdminAuth(write({}))?.status).toBe(403)
    const get = new Request('https://landly.test/api/admin/x', { headers: { cookie: `${ADMIN_SESSION_COOKIE}=${issueAdminSessionToken()}` } })
    expect(requireAdminAuth(get)).toBeNull()
  })
})
