import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { mergeOrderInternal, ORDER_INTERNAL_KEYS } from '@/lib/payments/orderInternal'

describe('mergeOrderInternal', () => {
  it('prefers the internal document', () => {
    expect(mergeOrderInternal({ commissionRate: 0.5, paymentTerms: 'net_0', reservedVoucherId: 'old' }, { commissionRate: 0.1, paymentTerms: 'net_30', reservedVoucherId: 'v', businessGeo: { lat: 1, lng: 2 } }))
      .toEqual({ commissionRate: 0.1, paymentTerms: 'net_30', reservedVoucherId: 'v', businessGeo: { lat: 1, lng: 2 } })
  })
  it('falls back to the fields of an order created before the split', () => {
    expect(mergeOrderInternal({ commissionRate: 0.1, paymentTerms: 'net_30', reservedVoucherId: 'v', businessGeo: null }, undefined))
      .toEqual({ commissionRate: 0.1, paymentTerms: 'net_30', reservedVoucherId: 'v', businessGeo: null })
  })
  it('ignores malformed values and an empty held code', () => {
    expect(mergeOrderInternal(undefined, { commissionRate: '0.1', paymentTerms: 5, reservedVoucherId: '' }))
      .toEqual({ commissionRate: null, paymentTerms: null, reservedVoucherId: null, businessGeo: null })
  })
})

describe('the member-readable order', () => {
  it('never maps an internal field: the client order document has none', async () => {
    vi.resetModules()
    vi.doMock('@/lib/firebase/config', () => ({ db: {} }))
    const source = (await import('node:fs')).readFileSync('lib/firebase/orders.ts', 'utf8')
    for (const key of ORDER_INTERNAL_KEYS) expect(source).not.toContain(key)
  })
})
