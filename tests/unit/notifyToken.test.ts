import { describe, expect, it } from 'vitest'
import { buildNotifyUrl, signNotifyToken, verifyNotifyToken } from '@/lib/payments/notifyToken'

const claims = { orderId: 'user_offer', terminal: 'landly', amountAgorot: 1025 }

describe('notify token', () => {
  it('verifies for the exact order, terminal and amount', () => {
    const token = signNotifyToken(claims, 'secret')
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(verifyNotifyToken(token, claims, 'secret')).toBe(true)
  })
  it('rejects any changed claim, another secret, or a malformed token', () => {
    const token = signNotifyToken(claims, 'secret')
    expect(verifyNotifyToken(token, { ...claims, orderId: 'other_offer' }, 'secret')).toBe(false)
    expect(verifyNotifyToken(token, { ...claims, amountAgorot: 1 }, 'secret')).toBe(false)
    expect(verifyNotifyToken(token, { ...claims, terminal: 'x' }, 'secret')).toBe(false)
    expect(verifyNotifyToken(token, claims, 'other')).toBe(false)
    expect(verifyNotifyToken(null, claims, 'secret')).toBe(false)
    expect(verifyNotifyToken('zz', claims, 'secret')).toBe(false)
    expect(verifyNotifyToken(token, claims, undefined)).toBe(false)
  })
  it('does not let claim fields collide by concatenation', () => {
    expect(signNotifyToken({ orderId: 'a', terminal: 'bc', amountAgorot: 1 }, 's')).not.toBe(signNotifyToken({ orderId: 'ab', terminal: 'c', amountAgorot: 1 }, 's'))
  })
  it('builds a notify URL carrying the order and its token', () => {
    const url = new URL(buildNotifyUrl('https://www.golandly.com', claims, 'secret'))
    expect(url.pathname).toBe('/api/payments/tranzila-webhook')
    expect(url.searchParams.get('o')).toBe('user_offer')
    expect(verifyNotifyToken(url.searchParams.get('t'), claims, 'secret')).toBe(true)
  })
})
