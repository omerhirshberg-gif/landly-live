import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryFirestore } from '../helpers/memoryFirestore'

const mocks = vi.hoisted(() => ({ store: null as unknown as MemoryFirestore }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => mocks.store.db }))
vi.mock('@/lib/auth/adminLoginThrottle', () => ({ reserveAdminLoginAttempt: async () => true, releaseAdminLoginAttempt: async () => {} }))

import { POST as login } from '@/app/api/admin/verify-password/route'
import { DELETE as logout, GET as session } from '@/app/api/admin/session/route'
import { POST as statusRoute } from '@/app/api/admin/whatsapp/status/route'
import { ADMIN_SESSION_COOKIE, adminSessionExpiry, issueAdminSessionToken, REMEMBER_TTL_MS, SESSION_TTL_MS } from '@/lib/admin/sessionToken'

const ORIGIN = 'https://landly.test'
const HOUR = 60 * 60

const signIn = (body: unknown) => login(new Request(`${ORIGIN}/api/admin/verify-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
const cookieOf = (res: Response) => res.headers.get('set-cookie') ?? ''
const tokenOf = (res: Response) => cookieOf(res).match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]*)`))?.[1] ?? ''
const withCookie = (token: string, extra: Record<string, string> = {}) => ({ cookie: `other=1; ${ADMIN_SESSION_COOKIE}=${token}`, ...extra })

beforeEach(() => {
  mocks.store = new MemoryFirestore()
  vi.stubEnv('ADMIN_PASSWORD', 'correct horse')
  vi.stubEnv('ADMIN_SESSION_SECRET', 'test-session-secret')
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('admin login cookie', () => {
  it('sets an httpOnly, SameSite=Lax cookie on / for 12 hours, and never hands the token to the page', async () => {
    const res = await signIn({ password: 'correct horse' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const cookie = cookieOf(res)
    expect(cookie).toContain(`Max-Age=${12 * HOUR}`)
    expect(cookie).toMatch(/Path=\//)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=lax/i)
    const expiry = adminSessionExpiry(tokenOf(res))!
    expect(Math.abs(expiry - (Date.now() + SESSION_TTL_MS))).toBeLessThan(5000)
  })

  it('lasts 30 days with Stay logged in', async () => {
    const res = await signIn({ password: 'correct horse', remember: true })
    expect(cookieOf(res)).toContain(`Max-Age=${30 * 24 * HOUR}`)
    expect(Math.abs(adminSessionExpiry(tokenOf(res))! - (Date.now() + REMEMBER_TTL_MS))).toBeLessThan(5000)
    // Only a real true counts.
    expect(cookieOf(await signIn({ password: 'correct horse', remember: 'yes' }))).toContain(`Max-Age=${12 * HOUR}`)
  })

  it('is Secure in production builds (every Vercel deployment), not on local http', async () => {
    expect(cookieOf(await signIn({ password: 'correct horse' }))).not.toMatch(/Secure/i)
    vi.stubEnv('NODE_ENV', 'production')
    expect(cookieOf(await signIn({ password: 'correct horse' }))).toMatch(/Secure/i)
  })

  it('sets nothing for a wrong password', async () => {
    const res = await signIn({ password: 'nope', remember: true })
    expect(res.status).toBe(401)
    expect(cookieOf(res)).toBe('')
  })
})

describe('admin session check and logout', () => {
  it('confirms a valid cookie, so a returning admin skips the login page', async () => {
    const token = tokenOf(await signIn({ password: 'correct horse', remember: true }))
    const res = await session(new Request(`${ORIGIN}/api/admin/session`, { headers: withCookie(token) }))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect((await res.json()).ok).toBe(true)
  })

  it('refuses a missing, tampered or expired session', async () => {
    const check = (headers: Record<string, string>) => session(new Request(`${ORIGIN}/api/admin/session`, { headers }))
    expect((await check({})).status).toBe(401)
    const token = issueAdminSessionToken(true)
    expect((await check(withCookie(`${token.split('.')[0]}.forged`))).status).toBe(401)
    expect((await check(withCookie(issueAdminSessionToken(false, Date.now() - SESSION_TTL_MS - 1000)))).status).toBe(401)
    vi.stubEnv('ADMIN_SESSION_SECRET', 'rotated-secret')
    expect((await check(withCookie(token))).status).toBe(401)
  })

  it('clears the cookie on logout with the attributes it was set with', async () => {
    const cookie = cookieOf(logout())
    expect(cookie).toContain(`${ADMIN_SESSION_COOKIE}=;`)
    expect(cookie).toContain('Max-Age=0')
    expect(cookie).toMatch(/Path=\//)
  })
})

describe('admin API calls with the cookie', () => {
  const change = (headers: Record<string, string>) =>
    statusRoute(new Request(`${ORIGIN}/api/admin/whatsapp/status`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ waId: '972501234567', status: 'resolved' }) }))

  it('accepts a change from our own pages', async () => {
    const token = issueAdminSessionToken()
    // Past auth: the conversation simply doesn't exist.
    expect((await change(withCookie(token, { origin: ORIGIN }))).status).toBe(404)
  })

  it('refuses a change sent with the cookie from another origin, or with no Origin at all', async () => {
    const token = issueAdminSessionToken()
    expect((await change(withCookie(token, { origin: 'https://evil.example' }))).status).toBe(403)
    expect((await change(withCookie(token, { origin: 'https://sub.landly.test' }))).status).toBe(403)
    expect((await change(withCookie(token))).status).toBe(403)
  })

  it('still takes a Bearer token, which no other site can make the browser send', async () => {
    const token = issueAdminSessionToken()
    expect((await change({ Authorization: `Bearer ${token}` })).status).toBe(404)
    expect((await change({ Authorization: 'Bearer forged.token' })).status).toBe(401)
  })
})

describe('admin pages', () => {
  it('keep the session out of page storage, and offer Stay logged in at login', () => {
    const client = readFileSync('lib/admin/adminSession.ts', 'utf8')
    expect(client).not.toMatch(/sessionStorage\.setItem|localStorage/)
    const page = readFileSync('app/admin/login/page.tsx', 'utf8')
    expect(page).toContain('Stay logged in')
    expect(page).toContain('זכור אותי')
    expect(page).toContain('JSON.stringify({ password, remember })')
    expect(readFileSync('components/admin/AdminGate.tsx', 'utf8')).toContain("router.replace('/admin')")
  })
})
