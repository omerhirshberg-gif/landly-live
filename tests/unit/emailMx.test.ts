import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkMailDomain, clearMailDomainCache, lookupMailDomain } from '@/lib/validation/emailDns.server'

const dnsError = (code: string) => Object.assign(new Error(code), { code })
type R = Parameters<typeof lookupMailDomain>[1]
const resolvers = (over: Record<string, unknown>): NonNullable<R> => ({
  resolveMx: vi.fn(async () => { throw dnsError('ENOTFOUND') }),
  resolve4: vi.fn(async () => { throw dnsError('ENOTFOUND') }),
  resolve6: vi.fn(async () => { throw dnsError('ENOTFOUND') }),
  ...over,
}) as unknown as NonNullable<R>

beforeEach(() => clearMailDomainCache())

describe('mail domain check', () => {
  it('accepts a domain with an MX record', async () => {
    expect(await lookupMailDomain('icloud.com', resolvers({ resolveMx: vi.fn(async () => [{ exchange: 'mx01.mail.icloud.com', priority: 10 }]) }))).toBe('ok')
  })
  it('rejects a domain that does not exist (ENOTFOUND everywhere)', async () => {
    expect(await lookupMailDomain('icloiud.com', resolvers({}))).toBe('invalid')
  })
  it('rejects ENODATA on MX with no address records', async () => {
    const r = resolvers({ resolveMx: vi.fn(async () => { throw dnsError('ENODATA') }), resolve4: vi.fn(async () => { throw dnsError('ENODATA') }), resolve6: vi.fn(async () => { throw dnsError('ENODATA') }) })
    expect(await lookupMailDomain('nomail.example', r)).toBe('invalid')
  })
  it('rejects a null MX (0 .)', async () => {
    expect(await lookupMailDomain('nullmx.example', resolvers({ resolveMx: vi.fn(async () => [{ exchange: '', priority: 0 }]) }))).toBe('invalid')
    expect(await lookupMailDomain('nullmx.example', resolvers({ resolveMx: vi.fn(async () => [{ exchange: '.', priority: 0 }]) }))).toBe('invalid')
  })
  it('falls back to the domain\'s own A record when there is no MX (RFC 5321)', async () => {
    const r = resolvers({ resolveMx: vi.fn(async () => []), resolve4: vi.fn(async () => ['192.0.2.1']) })
    expect(await lookupMailDomain('implicit.example', r)).toBe('ok')
  })
  it('falls back to AAAA too', async () => {
    const r = resolvers({ resolveMx: vi.fn(async () => { throw dnsError('ENODATA') }), resolve6: vi.fn(async () => ['2001:db8::1']) })
    expect(await lookupMailDomain('v6.example', r)).toBe('ok')
  })
  it.each(['ETIMEOUT', 'ESERVFAIL', 'ECONNREFUSED', 'EAI_AGAIN'])('lets the address through on %s (a DNS blip)', async (code) => {
    expect(await lookupMailDomain('blip.example', resolvers({ resolveMx: vi.fn(async () => { throw dnsError(code) }) }))).toBe('ok')
  })
  it('lets the address through when the fallback lookup fails transiently', async () => {
    const r = resolvers({ resolveMx: vi.fn(async () => []), resolve4: vi.fn(async () => { throw dnsError('ESERVFAIL') }) })
    expect(await lookupMailDomain('blip.example', r)).toBe('ok')
  })
  it('lets the address through when a lookup hangs past the timeout', async () => {
    vi.useFakeTimers()
    try {
      const pending = lookupMailDomain('slow.example', resolvers({ resolveMx: vi.fn(() => new Promise(() => {})) as never }))
      await vi.advanceTimersByTimeAsync(3000)
      expect(await pending).toBe('ok')
    } finally {
      vi.useRealTimers()
    }
  })
  it('caches a domain\'s answer for ten minutes', async () => {
    const resolveMx = vi.fn(async () => [{ exchange: 'mx.example', priority: 1 }])
    const r = resolvers({ resolveMx })
    expect(await checkMailDomain('a@cached.example', r)).toBe('ok')
    expect(await checkMailDomain('b@cached.example', r)).toBe('ok')
    expect(resolveMx).toHaveBeenCalledTimes(1)
    vi.useFakeTimers()
    try {
      vi.setSystemTime(Date.now() + 11 * 60 * 1000)
      await checkMailDomain('c@cached.example', r)
      expect(resolveMx).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
  it('rejects an address with no domain', async () => {
    expect(await checkMailDomain('nodomain', resolvers({}))).toBe('invalid')
  })
})
