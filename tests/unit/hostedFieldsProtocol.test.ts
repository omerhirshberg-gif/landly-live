import { describe, expect, it } from 'vitest'
import {
  isAllowedCardFrameUrl, parseCardFrameEvent, parseCardFrameInit, parseCardFrameState, parseHostedPaymentParams,
} from '@/lib/payments/hostedFieldsProtocol'
import { classifyChargeResult } from '@/lib/payments/hostedFieldsResult'

const payment = {
  provider: 'tranzila-hosted-fields', terminal: 'landly', thtk: 'abcdefgh12345678', expiresAtMs: Date.now() + 60_000,
  amountAgorot: 1025, currency: 'ILS', notifyUrl: 'https://www.golandly.com/api/payments/tranzila-webhook?o=a&t=b',
}
const init = { v: 1, type: 'init', payment, lang: 'he', dir: 'rtl', priceLabel: '₪10.25' }

describe('card frame bridge', () => {
  it('accepts a well-formed init, as an object or as the WebView bridge JSON string', () => {
    expect(parseCardFrameInit(init)).toMatchObject({ type: 'init', lang: 'he', dir: 'rtl' })
    expect(parseCardFrameInit(JSON.stringify(init))?.payment.thtk).toBe('abcdefgh12345678')
  })
  it('rejects a malformed or hostile init', () => {
    for (const bad of [
      { ...init, v: 2 }, { ...init, lang: 'de' }, { ...init, dir: 'up' }, { ...init, priceLabel: 'x'.repeat(41) },
      { ...init, payment: { ...payment, notifyUrl: 'http://evil.test/x' } },
      { ...init, payment: { ...payment, thtk: 'bad token!' } },
      { ...init, payment: { ...payment, terminal: '../x' } },
      { ...init, payment: { ...payment, amountAgorot: 0 } },
      { ...init, payment: { ...payment, amountAgorot: 1.5 } },
      { ...init, payment: { ...payment, currency: 'USD' } },
      { ...init, payment: { ...payment, scriptUrl: 'https://evil.test/x.js' }, extra: 1, lang: 'xx' },
      'not json', null, 42, JSON.stringify(init) + ' '.repeat(5000),
    ]) expect(parseCardFrameInit(bad)).toBeNull()
  })
  it('does not pass an injected script URL through', () => {
    expect(parseHostedPaymentParams({ ...payment, scriptUrl: 'https://evil.test/x.js' })).not.toHaveProperty('scriptUrl')
  })
  it('parses frame events and refuses unknown ones', () => {
    expect(parseCardFrameEvent({ v: 1, type: 'hello' })).toEqual({ v: 1, type: 'hello' })
    expect(parseCardFrameEvent('{"v":1,"type":"charged"}')).toEqual({ v: 1, type: 'charged' })
    expect(parseCardFrameEvent({ v: 1, type: 'height', px: 301.2 })).toEqual({ v: 1, type: 'height', px: 302 })
    expect(parseCardFrameEvent({ v: 1, type: 'error', code: 'declined' })).toEqual({ v: 1, type: 'error', code: 'declined' })
    for (const bad of [{ v: 1, type: 'error', code: 'boom' }, { v: 1, type: 'height', px: -1 }, { v: 1, type: 'height', px: 99999 }, { v: 1, type: 'paid' }, { type: 'ready' }]) {
      expect(parseCardFrameEvent(bad)).toBeNull()
    }
  })
  it('parses the host state message', () => {
    expect(parseCardFrameState({ v: 1, type: 'state', busy: true, error: null })).toEqual({ v: 1, type: 'state', busy: true, error: null })
    expect(parseCardFrameState({ v: 1, type: 'state', busy: false, error: 'declined' })?.error).toBe('declined')
    expect(parseCardFrameState({ v: 1, type: 'state', busy: 'yes', error: null })).toBeNull()
    expect(parseCardFrameState({ v: 1, type: 'state', busy: true, error: 'nope' })).toBeNull()
  })
  it('limits WebView navigation to the GoLandly host and Tranzila', () => {
    const origin = 'https://www.golandly.com'
    expect(isAllowedCardFrameUrl('https://www.golandly.com/checkout/card-frame', origin)).toBe(true)
    expect(isAllowedCardFrameUrl('https://hf.tranzila.com/x', origin)).toBe(true)
    expect(isAllowedCardFrameUrl('https://tranzila.com/', origin)).toBe(true)
    expect(isAllowedCardFrameUrl('http://192.168.1.5:3000/checkout/card-frame', 'http://192.168.1.5:3000')).toBe(true)
    expect(isAllowedCardFrameUrl('https://evil.example/', origin)).toBe(false)
    expect(isAllowedCardFrameUrl('https://nottranzila.com/', origin)).toBe(false)
    expect(isAllowedCardFrameUrl('http://hf.tranzila.com/x', origin)).toBe(false)
    expect(isAllowedCardFrameUrl('javascript:alert(1)', origin)).toBe(false)
  })
})

describe('classifyChargeResult', () => {
  const ok = { transaction_response: { success: true, processor_response_code: '000', transaction_id: 1 } }
  it('reports a successful charge', () => expect(classifyChargeResult(null, ok)).toEqual({ ok: true }))
  it('maps validation errors to the failing fields', () => {
    expect(classifyChargeResult({ messages: [{ message: 'INVALID CREDIT CARD NUMBER', param: 'credit_card_number' }] }, null))
      .toEqual({ ok: false, code: 'validation', fields: ['credit_card_number'] })
  })
  it('maps an expired or mismatched handshake to a session refresh', () => {
    expect(classifyChargeResult({ messages: [{ message: 'Illegal Operation 912791', param: 'thtk' }] }, null)).toMatchObject({ code: 'thtk_expired' })
  })
  it('maps declines, 3DS failures and transport errors', () => {
    expect(classifyChargeResult(null, { transaction_response: { success: false, processor_response_code: '033' } })).toMatchObject({ code: 'declined' })
    expect(classifyChargeResult(null, { transaction_response: { success: false, error: '3DS authentication failed' } })).toMatchObject({ code: '3ds_failed' })
    expect(classifyChargeResult(new Error('x'), null)).toMatchObject({ code: 'network' })
    expect(classifyChargeResult(null, undefined)).toMatchObject({ code: 'network' })
    expect(classifyChargeResult(null, { transaction_response: { success: true, processor_response_code: '033' } })).toMatchObject({ ok: false })
  })
})
