import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assertMatchesExpected, failClosedVerifier, getTranzilaVerifier, setTranzilaVerifier, verifyResponseHash,
} from '@/lib/payments/verifyTranzilaTransaction'
import { verifiedTx } from '../helpers/tranzilaLive'

afterEach(() => setTranzilaVerifier(null))
const expected = { orderId: 'user_offer', terminal: 'landly_test', amountAgorot: 1025 }

describe('verifier registry', () => {
  it('is fail-closed by default: 503 for both lookups', async () => {
    expect(getTranzilaVerifier()).toBe(failClosedVerifier)
    await expect(getTranzilaVerifier().byTransactionId('t', '1')).rejects.toMatchObject({ status: 503 })
    await expect(getTranzilaVerifier().byOrderId('t', 'o')).rejects.toMatchObject({ status: 503 })
  })
})

describe('assertMatchesExpected', () => {
  it('accepts a matching record, with or without an echoed order id', () => {
    expect(() => assertMatchesExpected(verifiedTx, expected)).not.toThrow()
    expect(() => assertMatchesExpected({ ...verifiedTx, orderId: 'user_offer' }, expected)).not.toThrow()
  })
  it('rejects a different amount, terminal, order, currency, mode or transaction id', () => {
    for (const changed of [{ amountAgorot: 1 }, { terminal: 'x' }, { orderId: 'other' }, { tranmode: 'V' }, { currency: 'USD' }] as const) {
      expect(() => assertMatchesExpected({ ...verifiedTx, ...changed } as never, expected)).toThrow(/reconciliation/)
    }
    expect(() => assertMatchesExpected(verifiedTx, { ...expected, tranzilaTxnId: '999' })).toThrow(/reconciliation/)
  })
})

describe('verifyResponseHash', () => {
  const hash = createHmac('sha256', 'secret').update('payload').digest('hex')
  it('verifies an HMAC-SHA256 hex over the supplied canonical string', () => {
    expect(verifyResponseHash('payload', hash, 'secret')).toBe(true)
    expect(verifyResponseHash('payload', hash.toUpperCase(), 'secret')).toBe(true)
  })
  it('fails closed without a secret, a canonical string, or a well-formed hash', () => {
    expect(verifyResponseHash('payload', hash, null)).toBe(false)
    expect(verifyResponseHash('', hash, 'secret')).toBe(false)
    expect(verifyResponseHash('payload', 'short', 'secret')).toBe(false)
    expect(verifyResponseHash('tampered', hash, 'secret')).toBe(false)
  })
})
