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
  it('reads both documented error shapes: err.messages[] and errors[] with a code (10001-10016)', () => {
    expect(classifyChargeResult({ errors: [{ code: 10002, param: 'credit_card_number', message: 'Invalid credit card number' }] }, null))
      .toEqual({ ok: false, code: 'validation', fields: ['credit_card_number'] })
    expect(classifyChargeResult(null, { errors: [{ code: 10004, message: 'Invalid expiry' }] })).toEqual({ ok: false, code: 'validation', fields: ['expiry'] })
    expect(classifyChargeResult({ errors: [{ code: 10003, message: 'Invalid cvv' }, { code: 10002, message: 'x' }] }, null))
      .toEqual({ ok: false, code: 'validation', fields: ['cvv', 'credit_card_number'] })
    // A missing key, bad terminal or amount is not the member's typing.
    expect(classifyChargeResult({ errors: [{ code: 10000, message: 'MANDATORY KEY IS MISSING' }] }, null)).toMatchObject({ code: 'network' })
    // 10001 is INVALID TERMINAL NAME: our configuration, not a stale handshake and not the member's typing.
    expect(classifyChargeResult({ errors: [{ code: 10001, message: 'INVALID TERMINAL NAME' }] }, null)).toEqual({ ok: false, code: 'network', fields: [] })
    expect(classifyChargeResult({ errors: [{ code: 10013, message: 'TERMINAL NOT FOUND OR BAD CONFIGURATION' }] }, null)).toMatchObject({ code: 'network' })
    // A missing or refused handshake token (or the amount-mismatch 912791) asks for a fresh one.
    expect(classifyChargeResult({ errors: [{ code: 10000, param: 'thtk', message: 'MANDATORY KEY IS MISSING' }] }, null)).toMatchObject({ code: 'thtk_expired' })
    expect(classifyChargeResult({ messages: [{ message: 'Illegal Operation 912791' }] }, null)).toMatchObject({ code: 'thtk_expired' })
    expect(classifyChargeResult({ messages: [] }, null)).toMatchObject({ code: 'network' })
  })
})

import { CHALLENGE_MIN_HEIGHT, cardFrameHeight, nextCardFramePhase, sanitizeCardHolder } from '@/lib/payments/hostedFieldsProtocol'

describe('cardHolder (3-D Secure inputs)', () => {
  const init = { v: 1, type: 'init', payment, lang: 'en', dir: 'ltr', priceLabel: '₪49' }
  it('is optional and accepted when it is a plain name and email', () => {
    expect(parseCardFrameInit(init)).not.toHaveProperty('cardHolder')
    expect(parseCardFrameInit({ ...init, cardHolder: { name: '  Dana   Levi ', email: 'dana@example.com' } })?.cardHolder).toEqual({ name: 'Dana Levi', email: 'dana@example.com' })
    expect(parseCardFrameInit({ ...init, cardHolder: { name: 'דנה לוי' } })?.cardHolder).toEqual({ name: 'דנה לוי' })
  })
  it('drops anything unusable instead of forwarding it', () => {
    expect(sanitizeCardHolder({ name: 'x'.repeat(101), email: 'not-an-email' })).toBeUndefined()
    expect(sanitizeCardHolder({ name: '\u0000\n', email: 'a b@c.de' })).toBeUndefined()
    expect(sanitizeCardHolder({ email: `${'a'.repeat(250)}@b.co` })).toBeUndefined()
    expect(sanitizeCardHolder({ name: 'Dana', email: 42 })).toEqual({ name: 'Dana' })
    expect(sanitizeCardHolder(null)).toBeUndefined()
    expect(sanitizeCardHolder('Dana')).toBeUndefined()
  })
})

describe('card frame phase (3-D Secure room)', () => {
  it('walks idle -> charging -> confirming, and any error returns to idle', () => {
    expect(nextCardFramePhase('idle', { v: 1, type: 'submitting' })).toBe('charging')
    expect(nextCardFramePhase('charging', { v: 1, type: 'charged' })).toBe('confirming')
    expect(nextCardFramePhase('charging', { v: 1, type: 'error', code: 'declined' })).toBe('idle')
    expect(nextCardFramePhase('confirming', { v: 1, type: 'error', code: 'declined' })).toBe('idle')
    expect(nextCardFramePhase('charging', { v: 1, type: 'ready' })).toBe('charging')
  })
  it('keeps the frame at least as tall as the 400x600 challenge while charging, and compact otherwise', () => {
    expect(CHALLENGE_MIN_HEIGHT).toBeGreaterThanOrEqual(600)
    expect(cardFrameHeight('idle', 340)).toBe(340)
    expect(cardFrameHeight('confirming', 340)).toBe(340)
    expect(cardFrameHeight('charging', 340)).toBe(CHALLENGE_MIN_HEIGHT)
    expect(cardFrameHeight('charging', 900)).toBe(900)
    expect(cardFrameHeight('idle', 10)).toBe(200)
  })
  it('parses the wallet flags and defaults them to off', () => {
    const base = { provider: 'tranzila-hosted-fields', terminal: 'abc', thtk: 'abcdefgh12345678', expiresAtMs: 1, amountAgorot: 100, currency: 'ILS', notifyUrl: 'https://landly.test/api/payments/tranzila-webhook?o=a&t=b' }
    expect(parseHostedPaymentParams(base)?.wallets).toEqual({ applePay: false, googlePay: false })
    expect(parseHostedPaymentParams({ ...base, wallets: { applePay: true, googlePay: 'yes' } })?.wallets).toEqual({ applePay: true, googlePay: false })
  })
})
