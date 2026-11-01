import { afterEach, describe, expect, it, vi } from 'vitest'
import { nativePassFailure, rebasePassUrl, requestWalletPass, walletFailureMessage } from '@/lib/wallet/walletClient'

const SERVER_URL = 'http://localhost:3000/api/wallet/apple/v1?ticket=123.uid.sig'

afterEach(() => vi.unstubAllGlobals())

describe('rebasePassUrl', () => {
  it('moves the pass onto the host the client reached', () => {
    expect(rebasePassUrl(SERVER_URL, 'http://192.168.7.57:3000')).toBe('http://192.168.7.57:3000/api/wallet/apple/v1?ticket=123.uid.sig')
  })

  it('stays same-origin on the website', () => {
    expect(rebasePassUrl(SERVER_URL, '')).toBe('/api/wallet/apple/v1?ticket=123.uid.sig')
  })

  it('normalizes the base, and leaves a relative URL whole', () => {
    expect(rebasePassUrl(SERVER_URL, 'https://golandly.com/')).toBe('https://www.golandly.com/api/wallet/apple/v1?ticket=123.uid.sig')
    expect(rebasePassUrl('/api/x?ticket=a', 'https://www.golandly.com')).toBe('https://www.golandly.com/api/x?ticket=a')
  })
})

describe('requestWalletPass', () => {
  it('hands the phone a URL it can reach', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ url: SERVER_URL, mock: false }))
    await expect(requestWalletPass('token', 'v1', 'http://192.168.7.57:3000')).resolves.toEqual({
      ok: true,
      url: 'http://192.168.7.57:3000/api/wallet/apple/v1?ticket=123.uid.sig',
      mock: false,
    })
  })

  it('reads a dropped connection as offline and a 429 as rate limited', async () => {
    vi.stubGlobal('fetch', async () => { throw new TypeError('Network request failed') })
    await expect(requestWalletPass('token', 'v1', '')).resolves.toEqual({ ok: false, reason: 'offline' })
    vi.stubGlobal('fetch', async () => Response.json({}, { status: 429 }))
    await expect(requestWalletPass('token', 'v1', '')).resolves.toEqual({ ok: false, reason: 'rateLimited' })
  })
})

describe('failures', () => {
  it('maps the native module\'s codes, and anything else to unavailable', () => {
    expect(nativePassFailure('ERR_PASS_NETWORK')).toBe('offline')
    expect(nativePassFailure('ERR_PASS_HTTP')).toBe('passDownload')
    expect(nativePassFailure('ERR_PASS_INVALID')).toBe('passInvalid')
    expect(nativePassFailure('ERR_PASS_SHEET')).toBe('unavailable')
    expect(nativePassFailure(undefined)).toBe('unavailable')
  })

  it('gives members a specific message only where they can act on it', () => {
    expect(walletFailureMessage('offline')).toBe('wallet_add_error_offline')
    expect(walletFailureMessage('rateLimited')).toBe('wallet_add_error_rate_limited')
    expect(walletFailureMessage('passInvalid')).toBe('wallet_add_error')
    expect(walletFailureMessage('passDownload')).toBe('wallet_add_error')
  })
})
