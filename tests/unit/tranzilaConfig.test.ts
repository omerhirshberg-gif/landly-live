import { describe, expect, it } from 'vitest'
import { notifyOrigin, readTranzilaConfig, requireTranzilaConfig, TranzilaConfigError } from '@/lib/payments/tranzilaConfig'

const full = { TRANZILA_TERMINAL: 'landly', TRANZILA_API_APP_KEY: 'k', TRANZILA_API_SECRET: 's', TRANZILA_WEBHOOK_SECRET: 'w' }

describe('readTranzilaConfig', () => {
  it('is off (sandbox decides) with no terminal, whatever else is set', () => {
    expect(readTranzilaConfig({})).toBeNull()
    expect(readTranzilaConfig({ PAYMENT_SANDBOX: '1', TRANZILA_API_SECRET: 's' })).toBeNull()
  })
  it('returns the live settings with defaults', () => {
    expect(readTranzilaConfig(full)).toMatchObject({ terminal: 'landly', handshakeUrl: 'https://api.tranzila.com/v2/handshake/create', responseHashSecret: null })
  })
  it('is all-or-nothing: a terminal without credentials is a hard error naming what is missing', () => {
    expect(() => readTranzilaConfig({ TRANZILA_TERMINAL: 'landly' })).toThrow(/TRANZILA_API_APP_KEY, TRANZILA_API_SECRET, TRANZILA_WEBHOOK_SECRET are missing/)
    expect(() => readTranzilaConfig({ ...full, TRANZILA_WEBHOOK_SECRET: '' })).toThrow(/TRANZILA_WEBHOOK_SECRET is missing/)
  })
  it('refuses the sandbox flag beside a live terminal', () => {
    expect(() => readTranzilaConfig({ ...full, PAYMENT_SANDBOX: '1' })).toThrow(TranzilaConfigError)
  })
  it('refuses secrets exposed as NEXT_PUBLIC variables', () => {
    expect(() => readTranzilaConfig({ ...full, NEXT_PUBLIC_TRANZILA_API_SECRET: 'x' })).toThrow(/NEXT_PUBLIC_/)
    expect(() => readTranzilaConfig({ NEXT_PUBLIC_TRANZILA_PASSWORD: 'x' })).toThrow(/NEXT_PUBLIC_/)
    expect(readTranzilaConfig({ ...full, NEXT_PUBLIC_TRANZILA_TERMINAL_LABEL: 'ok' })).not.toBeNull()
  })
  it('validates the terminal name and the handshake URL', () => {
    expect(() => readTranzilaConfig({ ...full, TRANZILA_TERMINAL: 'bad name!' })).toThrow(/malformed/)
    expect(() => readTranzilaConfig({ ...full, TRANZILA_HANDSHAKE_URL: 'http://api.tranzila.com/x' })).toThrow(/https/)
    expect(() => readTranzilaConfig({ ...full, TRANZILA_HANDSHAKE_URL: 'https://evil.example/x' })).toThrow(/tranzila\.com/)
    expect(readTranzilaConfig({ ...full, TRANZILA_HANDSHAKE_URL: 'https://api.tranzila.com/v2/handshake/create' })).not.toBeNull()
  })
  it('requireTranzilaConfig throws without a terminal', () => {
    expect(() => requireTranzilaConfig({})).toThrow('Payment terminal is not configured.')
  })
})

describe('notifyOrigin', () => {
  it('prefers the explicit origin, then production, then the deployment; never a request host', () => {
    expect(notifyOrigin({ TRANZILA_NOTIFY_ORIGIN: 'https://pay.example.com/ignored' })).toBe('https://pay.example.com')
    expect(notifyOrigin({ VERCEL_ENV: 'production' })).toBe('https://www.golandly.com')
    expect(notifyOrigin({ VERCEL_ENV: 'preview', VERCEL_URL: 'landly-git-x.vercel.app' })).toBe('https://landly-git-x.vercel.app')
    expect(() => notifyOrigin({})).toThrow(TranzilaConfigError)
    expect(() => notifyOrigin({ TRANZILA_NOTIFY_ORIGIN: 'http://x.test' })).toThrow(/https/)
  })
})
