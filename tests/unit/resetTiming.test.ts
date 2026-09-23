import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ generate: vi.fn(), send: vi.fn(), limited: vi.fn() }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminAuth: () => ({ generatePasswordResetLink: mocks.generate }) }))
vi.mock('@/lib/email/sendPasswordResetEmail', () => ({ sendPasswordResetEmail: mocks.send }))
vi.mock('@/lib/auth/passwordResetRateLimit', () => ({ isPasswordResetRateLimited: mocks.limited }))
vi.mock('@/lib/auth/requestContext', () => ({ applicationOrigin: () => 'https://test.invalid', isValidLang: (value: unknown) => value === 'en' }))
import { POST } from '@/app/api/auth/forgot-password/route'
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks()
  mocks.generate.mockResolvedValue('https://test.invalid/reset')
  mocks.send.mockResolvedValue(undefined)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it.each(['existing', 'missing', 'send failure', 'empty', 'malformed'])('holds %s responses until the same floor', async (scenario) => {
  if (scenario === 'missing') mocks.generate.mockRejectedValue({ code: 'auth/user-not-found' })
  if (scenario === 'send failure') mocks.send.mockRejectedValue(new Error('unavailable'))
  const body = scenario === 'malformed' ? '{' : JSON.stringify({ email: scenario === 'empty' ? '' : 'user@example.com' })
  let settled = false
  const result = POST(new Request('https://test.invalid', { method: 'POST', body })).then((response) => { settled = true; return response })
  await vi.advanceTimersByTimeAsync(1999)
  expect(settled).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  expect(settled).toBe(true)
  const response = await result
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ ok: true })
})
it('waits only the remaining floor after upstream work', async () => {
  mocks.send.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1200)))
  let settled = false
  const result = POST(new Request('https://test.invalid', { method: 'POST', body: '{"email":"user@example.com"}' })).then(() => { settled = true })
  await vi.advanceTimersByTimeAsync(1999)
  expect(settled).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  await result
  expect(settled).toBe(true)
})
it('does not add another delay when upstream work exceeds the floor', async () => {
  mocks.send.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 2500)))
  const result = POST(new Request('https://test.invalid', { method: 'POST', body: '{"email":"user@example.com"}' }))
  await vi.advanceTimersByTimeAsync(2500)
  expect((await result).status).toBe(200)
  expect(vi.getTimerCount()).toBe(0)
})
it('rejects rate-limited requests immediately without sending email', async () => {
  mocks.limited.mockReturnValue(true)
  expect((await POST(new Request('https://test.invalid', { method: 'POST' }))).status).toBe(429)
  expect(mocks.generate).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})
