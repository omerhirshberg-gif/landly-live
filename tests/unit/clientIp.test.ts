import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clientIp } from '@/lib/auth/clientIp'

const request = (headers: Record<string, string> = {}) => new Request('https://test.invalid', { headers })

beforeEach(() => { vi.stubEnv('VERCEL', ''); vi.stubEnv('TRUSTED_IP_HEADER', '') })
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules() })

describe('clientIp off Vercel', () => {
  it("defaults to the shared 'unknown' bucket and ignores every header", () => {
    expect(clientIp(request({ 'x-real-ip': '192.0.2.1', 'x-forwarded-for': '192.0.2.2', 'x-vercel-forwarded-for': '192.0.2.3' }))).toBe('unknown')
  })

  it('reads only the header named by TRUSTED_IP_HEADER (case-insensitive)', () => {
    vi.stubEnv('TRUSTED_IP_HEADER', 'X-Real-IP')
    expect(clientIp(request({ 'x-real-ip': '192.0.2.1', 'x-forwarded-for': '192.0.2.2' }))).toBe('192.0.2.1')
    expect(clientIp(request({ 'x-forwarded-for': '192.0.2.2' }))).toBe('unknown')
  })

  it.each(['garbage', '1.2.3.4, 5.6.7.8', '1.2.3.4:123', '[::1]', 'fe80::1%eth0', '999.1.2.3', ''])('rejects malformed trusted-header value %s', (value) => {
    vi.stubEnv('TRUSTED_IP_HEADER', 'cf-connecting-ip')
    expect(clientIp(request({ 'cf-connecting-ip': value }))).toBe('unknown')
  })

  it.each(['', 'bad header', 'x_real_ip', 'x-real-ip\r\nx-evil'])('ignores an invalid TRUSTED_IP_HEADER name %j', (name) => {
    vi.stubEnv('TRUSTED_IP_HEADER', name)
    expect(clientIp(request({ 'x-real-ip': '192.0.2.1' }))).toBe('unknown')
  })

  it('normalizes IPv6 and IPv4-mapped addresses from the trusted header', () => {
    vi.stubEnv('TRUSTED_IP_HEADER', 'x-real-ip')
    expect(clientIp(request({ 'x-real-ip': '2001:0DB8:0000:0:0:0:0:1' }))).toBe('2001:db8::1')
    expect(clientIp(request({ 'x-real-ip': '::ffff:192.0.2.1' }))).toBe('192.0.2.1')
  })
})

describe('clientIp on Vercel', () => {
  it('uses only x-vercel-forwarded-for, even if TRUSTED_IP_HEADER is set', () => {
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('TRUSTED_IP_HEADER', 'x-real-ip')
    expect(clientIp(request({ 'x-vercel-forwarded-for': '192.0.2.1', 'x-real-ip': '198.51.100.9' }))).toBe('192.0.2.1')
    expect(clientIp(request({ 'x-real-ip': '198.51.100.9' }))).toBe('unknown')
  })
})

describe('startup warning', () => {
  const load = async () => (await import('@/lib/auth/clientIp')).clientIp

  it('logs once in production off Vercel without a trusted header', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('NODE_ENV', 'production')
    const fresh = await load()
    fresh(request())
    fresh(request())
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['in development', { NODE_ENV: 'development' }],
    ['on Vercel', { NODE_ENV: 'production', VERCEL: '1' }],
    ['with a trusted header', { NODE_ENV: 'production', TRUSTED_IP_HEADER: 'x-real-ip' }],
  ])('stays quiet %s', async (_label, env) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
    ;(await load())(request())
    expect(warn).not.toHaveBeenCalled()
  })
})
