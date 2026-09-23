import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(), getUser: vi.fn(), businessGet: vi.fn(),
}))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: () => ({ verifyIdToken: mocks.verifyIdToken, getUser: mocks.getUser }),
  getAdminDb: () => ({ collection: () => ({ doc: () => ({ get: mocks.businessGet }) }) }),
}))

import { getDecodedTokenFromRequest, requireBusinessUid, requireCustomer, requireVerifiedCustomerUid, RequestAuthError } from '@/lib/firebase/verifyRequestUser'

const request = () => new Request('https://landly.test', { headers: { authorization: 'Bearer token' } })
const decoded = (overrides: Record<string, unknown> = {}) => ({ uid: 'uid-1', email_verified: true, firebase: { sign_in_provider: 'password' }, ...overrides })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.verifyIdToken.mockResolvedValue(decoded())
  mocks.businessGet.mockResolvedValue({ exists: false })
  mocks.getUser.mockResolvedValue({ emailVerified: true, disabled: false })
})

describe('request role authentication', () => {
  it('checks token revocation and accepts a customer token', async () => {
    await expect(requireCustomer(request())).resolves.toMatchObject({ uid: 'uid-1' })
    expect(mocks.verifyIdToken).toHaveBeenCalledWith('token', true)
    expect(mocks.businessGet).toHaveBeenCalled()
  })

  it('requires a businesses document for business routes', async () => {
    mocks.businessGet.mockResolvedValue({ exists: true })
    await expect(requireBusinessUid(request())).resolves.toBe('uid-1')
    mocks.businessGet.mockResolvedValue({ exists: false })
    await expect(requireBusinessUid(request())).rejects.toMatchObject({ status: 403 })
  })

  it('rejects a business token from customer routes', async () => {
    mocks.businessGet.mockResolvedValue({ exists: true })
    await expect(requireCustomer(request())).rejects.toMatchObject({ status: 403 })
  })

  it('rejects revoked or disabled sessions as unauthenticated', async () => {
    for (const code of ['auth/id-token-revoked', 'auth/user-disabled', 'auth/id-token-expired']) {
      mocks.verifyIdToken.mockRejectedValueOnce(Object.assign(new Error(code), { code }))
      await expect(getDecodedTokenFromRequest(request())).resolves.toBeNull()
    }
  })

  it('returns service unavailable when token verification or role lookup fails unexpectedly', async () => {
    mocks.verifyIdToken.mockRejectedValue(Object.assign(new Error('network'), { code: 'ECONNRESET' }))
    await expect(requireCustomer(request())).rejects.toBeInstanceOf(RequestAuthError)
    await expect(requireCustomer(request())).rejects.toMatchObject({ status: 503 })
    mocks.verifyIdToken.mockResolvedValue(decoded())
    mocks.businessGet.mockRejectedValue(new Error('network'))
    await expect(requireCustomer(request())).rejects.toMatchObject({ status: 503 })
  })

  it('rechecks the live user record for stale email verification claims', async () => {
    mocks.verifyIdToken.mockResolvedValue(decoded({ email_verified: false }))
    mocks.getUser.mockResolvedValue({ emailVerified: false, disabled: false })
    await expect(requireVerifiedCustomerUid(request())).rejects.toMatchObject({ status: 403 })
    mocks.getUser.mockResolvedValue({ emailVerified: true, disabled: false })
    await expect(requireVerifiedCustomerUid(request())).resolves.toBe('uid-1')
  })
})
