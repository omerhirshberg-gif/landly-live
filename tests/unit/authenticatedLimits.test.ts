import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => {
  class AuthError extends Error { status = 401 }
  return { uid: vi.fn(), db: vi.fn(), AuthError }
})
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: mocks.db }))
vi.mock('@/lib/firebase/verifyRequestUser', () => ({ requireBusinessUid: mocks.uid, requireVerifiedCustomerUid: mocks.uid, RequestAuthError: mocks.AuthError }))
beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); vi.useFakeTimers(); mocks.uid.mockResolvedValue('user') })
afterEach(() => vi.useRealTimers())
it('shares the business budget across offers and vouchers and stops before queries', async () => {
  const { GET: offers } = await import('@/app/api/business/offers/route')
  const { GET: vouchers } = await import('@/app/api/business/vouchers/route')
  // Invalid requests still spend the authenticated budget, without querying data.
  for (let i = 0; i < 60; i++) {
    const response = i % 2 ? await offers(new Request('https://test.invalid?limit=invalid')) : await vouchers(new Request('https://test.invalid'))
    expect(response.status).toBe(400)
  }
  expect((await offers(new Request('https://test.invalid'))).status).toBe(429)
  expect((await vouchers(new Request('https://test.invalid?status=active'))).status).toBe(429)
  expect(mocks.db).not.toHaveBeenCalled()
  mocks.uid.mockResolvedValue('other')
  expect((await vouchers(new Request('https://test.invalid'))).status).toBe(400)
})
it('limits payment initiation before side effects, and cannot take UID from the request', async () => {
  const { POST } = await import('@/app/api/payments/initiate/route')
  for (let i = 0; i < 10; i++) expect((await POST(new Request('https://test.invalid', { method: 'POST' }))).status).toBe(400)
  expect((await POST(new Request('https://test.invalid', { method: 'POST', body: '{"uid":"other","offerId":"offer"}' }))).status).toBe(429)
  expect(mocks.db).not.toHaveBeenCalled()
  vi.advanceTimersByTime(60000)
  expect((await POST(new Request('https://test.invalid', { method: 'POST' }))).status).toBe(400)
})
it('authentication failures do not consume a UID budget', async () => {
  const { POST } = await import('@/app/api/payments/initiate/route')
  mocks.uid.mockRejectedValue(new mocks.AuthError('Unauthorized'))
  for (let i = 0; i < 11; i++) expect((await POST(new Request('https://test.invalid', { method: 'POST' }))).status).toBe(401)
  mocks.uid.mockResolvedValue('user')
  expect((await POST(new Request('https://test.invalid', { method: 'POST' }))).status).toBe(400)
})
