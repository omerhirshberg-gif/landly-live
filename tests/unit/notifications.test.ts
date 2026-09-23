import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseTranzilaNotification } from '@/lib/payments/parseTranzilaNotification'
import { amountInAgorot } from '@/lib/payments/paymentValidation'
import { isTranzilaWebhookSecret } from '@/lib/payments/verifyWebhookSecret'
import { form, notification, terminal } from '../helpers/paymentFixtures'

afterEach(() => vi.unstubAllEnvs())

describe('documented QSTR contract', () => {
  it.each(['000', '0'])('accepts exact documented approval %s', async (Response) => {
    expect(await parseTranzilaNotification(notification({ Response }), terminal)).toMatchObject({ approved: true, responseCode: '000', currency: 'ILS', amountAgorot: 1025 })
  })
  it('parses a decline without truthy coercion', async () => {
    expect(await parseTranzilaNotification(notification({ Response: '005' }), terminal)).toMatchObject({ approved: false })
  })
  it.each(['false', 'true', '', ' 000', '000 ', '0.0', '0e0', 'null'])('rejects malformed Response %j', async (Response) => {
    await expect(parseTranzilaNotification(notification({ Response }), terminal)).rejects.toThrow()
  })
  it.each<Record<string, string>>([
    { currency: '2' }, { currency: 'ILS' }, { currency: '' }, { index: '' }, { index: '0' },
    { index: '../x' }, { index: '1e3' }, { supplier: 'other' }, { orderId: 'orders/user' },
    { sum: '-1' }, { sum: '0' }, { sum: '10.255' }, { sum: '10.25junk' },
    { sum: '1e3' }, { sum: 'Infinity' }, { tranmode: 'V' }, { tranmode: 'K' },
    { tranmode: 'N' }, { tranmode: 'C123' }, { success: 'false' }, { transaction_id: '999' },
  ])('rejects %j', async (override) => {
    await expect(parseTranzilaNotification(notification(override), terminal)).rejects.toThrow()
  })
  it.each(Object.keys(form))('rejects duplicate critical field %s', async (key) => {
    const body = new URLSearchParams(form)
    body.append(key, form[key as keyof typeof form])
    await expect(parseTranzilaNotification(new Request('https://test.invalid', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
    }), terminal)).rejects.toThrow()
  })
  it.each([false, true, 'false', 'true', 0, 1])('rejects the old JSON success contract (%j)', async (success) => {
    await expect(parseTranzilaNotification(new Request('https://test.invalid', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ success }),
    }), terminal)).rejects.toThrow('QSTR')
  })
  it('normalizes equivalent transaction identifiers', async () => {
    expect(await parseTranzilaNotification(notification({ index: '00123', transaction_id: '123' }), terminal)).toMatchObject({ tranzilaTxnId: '123' })
  })
  it('bounds the body size', async () => {
    await expect(parseTranzilaNotification(notification({ unused: 'x'.repeat(65537) }), terminal)).rejects.toThrow('too large')
  })
  it.each([['0.01', 1], ['10.1', 1010], [10.25, 1025], ['10', 1000]])('parses money %s without rounding', (value, expected) => {
    expect(amountInAgorot(value)).toBe(expected)
  })
  it.each([true, false, null, [], {}, NaN, Infinity])('rejects coerced money %j', (value) => {
    expect(() => amountInAgorot(value)).toThrow()
  })
})

it('retains fail-closed, exact shared-secret authentication', () => {
  vi.stubEnv('TRANZILA_WEBHOOK_SECRET', '')
  expect(isTranzilaWebhookSecret('anything')).toBe(false)
  vi.stubEnv('TRANZILA_WEBHOOK_SECRET', 'secret')
  expect(isTranzilaWebhookSecret(null)).toBe(false)
  expect(isTranzilaWebhookSecret('secreT')).toBe(false)
  expect(isTranzilaWebhookSecret('short')).toBe(false)
  expect(isTranzilaWebhookSecret('secret')).toBe(true)
})
