import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAllowedOrigin } from '@/lib/auth/cors'

afterEach(() => vi.unstubAllEnvs())

describe('CORS loopback origins', () => {
  it('allows loopback in local development', () => {
    vi.stubEnv('VERCEL', '')
    expect(isAllowedOrigin('http://localhost:8081')).toBe(true)
  })
  it('refuses loopback on any Vercel deployment', () => {
    vi.stubEnv('VERCEL', '1')
    expect(isAllowedOrigin('http://localhost:8081')).toBe(false)
    expect(isAllowedOrigin('http://127.0.0.1:3000')).toBe(false)
  })
  it('still honours the configured origins on Vercel', () => {
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('CORS_ALLOWED_ORIGINS', 'https://app.golandly.com')
    expect(isAllowedOrigin('https://app.golandly.com')).toBe(true)
    expect(isAllowedOrigin('https://evil.example')).toBe(false)
  })
})
