import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { MemoryFirestore } from '../helpers/memoryFirestore'

const mocks = vi.hoisted(() => ({
  store: null as unknown as MemoryFirestore,
  requireCustomer: vi.fn(),
  revokeRefreshTokens: vi.fn(),
  getUser: vi.fn(),
  currentUser: null as null | { getIdToken: (force?: boolean) => Promise<string> },
  signInWithCustomToken: vi.fn(),
}))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: () => mocks.store.db,
  getAdminAuth: () => ({ revokeRefreshTokens: mocks.revokeRefreshTokens, getUser: mocks.getUser }),
}))
vi.mock('@/lib/firebase/verifyRequestUser', () => ({
  requireCustomer: mocks.requireCustomer,
  RequestAuthError: class extends Error {
    constructor(message: string, public readonly status: number) { super(message) }
  },
}))
vi.mock('@/lib/auth/uidRateLimit', () => ({ checkUidRateLimit: () => null }))
vi.mock('@/lib/firebase/config', () => ({ auth: { get currentUser() { return mocks.currentUser } }, db: {} }))
vi.mock('firebase/auth', () => ({ signInWithCustomToken: mocks.signInWithCustomToken }))

import { revokeMemberSessions } from '@/lib/auth/sessionRevocation'
import { POST as revokeSessions } from '@/app/api/account/revoke-sessions/route'
import { recheckSessionIfDenied } from '@/lib/firebase/sessionCheck'
import { finishEmailChange } from '@/lib/account/contactChange'
import { redeemVoucherKey, voucherRedeemUrl } from '@/lib/firebase/vouchers'

const UID = 'member-1'
const VALID_AFTER = 'Fri, 23 Oct 2026 10:00:05 GMT'
const stamp = () => (mocks.store.read(`users/${UID}`)?.sessionsValidAfter as Timestamp | undefined)?.toMillis()

beforeEach(() => {
  vi.clearAllMocks()
  mocks.store = new MemoryFirestore()
  mocks.store.seed(`users/${UID}`, { email: 'a@landly.test' })
  mocks.revokeRefreshTokens.mockResolvedValue(undefined)
  mocks.getUser.mockResolvedValue({ tokensValidAfterTime: VALID_AFTER })
  mocks.requireCustomer.mockResolvedValue({ uid: UID })
  mocks.currentUser = null
})

describe('revokeMemberSessions', () => {
  it("revokes, then stamps Auth's own cutoff (whole seconds, like auth_time) on the profile", async () => {
    await revokeMemberSessions(UID)
    expect(mocks.revokeRefreshTokens).toHaveBeenCalledWith(UID)
    expect(stamp()).toBe(Date.parse(VALID_AFTER))
    expect(mocks.store.read(`users/${UID}`)?.email).toBe('a@landly.test')
  })

  it('falls back to the current whole second when Auth reports no cutoff', async () => {
    mocks.getUser.mockResolvedValue({})
    const before = Math.floor(Date.now() / 1000) * 1000
    await revokeMemberSessions(UID)
    expect(stamp()! % 1000).toBe(0)
    expect(stamp()!).toBeGreaterThanOrEqual(before)
  })

  it('creates no profile for a member who has none', async () => {
    await expect(revokeMemberSessions('no-profile')).resolves.toBeUndefined()
    expect(mocks.store.read('users/no-profile')).toBeUndefined()
  })

  it('stamps nothing when the revocation itself fails', async () => {
    mocks.revokeRefreshTokens.mockRejectedValue(new Error('auth down'))
    await expect(revokeMemberSessions(UID)).rejects.toThrow('auth down')
    expect(stamp()).toBeUndefined()
  })
})

describe('/api/account/revoke-sessions', () => {
  const post = () => revokeSessions(new Request('https://landly.test/api/account/revoke-sessions', { method: 'POST', headers: { Authorization: 'Bearer t' } }))

  it("ends the caller's sessions in Auth and Firestore alike", async () => {
    const res = await post()
    expect(res.status).toBe(200)
    expect(mocks.revokeRefreshTokens).toHaveBeenCalledWith(UID)
    expect(stamp()).toBe(Date.parse(VALID_AFTER))
  })

  it('reports a failure when the cutoff cannot be stored, so the member tries again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getUser.mockRejectedValue(new Error('auth down'))
    const res = await post()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'revoke_failed' })
  })
})

describe('recheckSessionIfDenied', () => {
  it('forces one token refresh for a refused listener, however many fail at once', async () => {
    let finish!: () => void
    const getIdToken = vi.fn(() => new Promise<string>((resolve) => { finish = () => resolve('t') }))
    mocks.currentUser = { getIdToken }
    recheckSessionIfDenied({ code: 'permission-denied' })
    recheckSessionIfDenied({ code: 'permission-denied' })
    expect(getIdToken).toHaveBeenCalledTimes(1)
    expect(getIdToken).toHaveBeenCalledWith(true)
    finish()
    await new Promise((r) => setTimeout(r, 0))
    recheckSessionIfDenied({ code: 'permission-denied' })
    expect(getIdToken).toHaveBeenCalledTimes(2)
    finish()
    await new Promise((r) => setTimeout(r, 0))
  })

  it('ignores other errors and signed-out devices, and never throws on a failed refresh', async () => {
    const getIdToken = vi.fn(() => Promise.reject(Object.assign(new Error('revoked'), { code: 'auth/user-token-expired' })))
    mocks.currentUser = { getIdToken }
    recheckSessionIfDenied({ code: 'unavailable' })
    recheckSessionIfDenied(null)
    expect(getIdToken).not.toHaveBeenCalled()
    recheckSessionIfDenied({ code: 'permission-denied' })
    await new Promise((r) => setTimeout(r, 0))
    expect(getIdToken).toHaveBeenCalledTimes(1)
    mocks.currentUser = null
    expect(() => recheckSessionIfDenied({ code: 'permission-denied' })).not.toThrow()
  })
})

describe('finishEmailChange', () => {
  it('signs this device back in with the custom token, or only reloads without one', async () => {
    const auth = {} as never
    const user = { reload: vi.fn().mockResolvedValue(undefined) }
    await finishEmailChange(auth, user as never, 'fresh-token')
    expect(mocks.signInWithCustomToken).toHaveBeenCalledWith(auth, 'fresh-token')
    expect(user.reload).not.toHaveBeenCalled()
    await finishEmailChange(auth, user as never, undefined)
    expect(user.reload).toHaveBeenCalledTimes(1)
    expect(mocks.signInWithCustomToken).toHaveBeenCalledTimes(1)
  })
})

describe('voucher QR key', () => {
  it('encodes the random redeem token, never the predictable voucher id', () => {
    const token = '0123456789abcdef0123456789abcdef'
    expect(voucherRedeemUrl(redeemVoucherKey({ id: 'uid_offer', redeemToken: token }))).toBe(`https://golandly.com/redeem/${token}`)
    // Only a voucher from before tokens (not yet backfilled) still shows its id.
    expect(redeemVoucherKey({ id: 'uid_offer', redeemToken: null })).toBe('uid_offer')
  })
})
