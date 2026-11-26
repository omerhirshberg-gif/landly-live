import { afterEach, expect, it, vi } from 'vitest'
import { GET } from '@/app/.well-known/apple-developer-merchantid-domain-association/route'

afterEach(() => vi.unstubAllEnvs())

it('is a 404 until the verification file is configured', async () => {
  vi.stubEnv('TRANZILA_APPLE_PAY_DOMAIN_ASSOCIATION', '')
  expect(GET().status).toBe(404)
})
it('serves the configured content as application/octet-stream, as Tranzila\'s guide recommends for the extensionless file', async () => {
  vi.stubEnv('TRANZILA_APPLE_PAY_DOMAIN_ASSOCIATION', '  abc123  ')
  const res = GET()
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toBe('application/octet-stream')
  expect(await res.text()).toBe('abc123')
})
it('refuses an absurdly large value rather than serving it', () => {
  vi.stubEnv('TRANZILA_APPLE_PAY_DOMAIN_ASSOCIATION', 'x'.repeat(70_000))
  expect(GET().status).toBe(404)
})
