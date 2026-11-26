import { describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'

vi.mock('server-only', () => ({}))
import { countMemberHolds } from '@/lib/inventory/ledger/stock'

const now = Timestamp.fromMillis(1_000_000)
const later = Timestamp.fromMillis(1_000_000 + 60_000)
const earlier = Timestamp.fromMillis(1_000_000 - 60_000)

// `orders` are the order documents (legacy: reservedVoucherId on the order itself); `internals` are orders/{id}/internal/terms by order id.
function fakeDb(orders: Record<string, unknown>[], vouchers: Record<string, Record<string, unknown>>, internals: Record<string, Record<string, unknown>> = {}) {
  const query = { where: () => query, limit: () => query, get: async () => ({ docs: orders.map((o) => ({ id: o.id as string, data: () => o })) }) }
  const internalOf = (orderId: string) => ({ id: `internal:${orderId}`, collection: () => ({ doc: () => ({ id: `internal:${orderId}` }) }) })
  return {
    collection: (name: string) => name === 'orders' ? { ...query, doc: (id: string) => internalOf(id) } : { doc: (id: string) => ({ id }) },
    getAll: async (...refs: { id: string }[]) => refs.map((r) => {
      const data = r.id.startsWith('internal:') ? internals[r.id.slice(9)] : vouchers[r.id]
      return { exists: !!data, data: () => data }
    }),
  } as never
}

describe('countMemberHolds', () => {
  it('counts only live holds of the member\'s other pending orders', async () => {
    const db = fakeDb(
      [{ id: 'me', reservedVoucherId: 'v0' }, { id: 'a', reservedVoucherId: 'v1' }, { id: 'b', reservedVoucherId: 'v2' }, { id: 'c', reservedVoucherId: 'v3' }, { id: 'd' }],
      {
        v0: { status: 'RESERVED', reservedForOrderId: 'me', reservedUntil: later },
        v1: { status: 'RESERVED', reservedForOrderId: 'a', reservedUntil: later },
        v2: { status: 'RESERVED', reservedForOrderId: 'b', reservedUntil: earlier }, // lapsed
        v3: { status: 'IN_STOCK', reservedForOrderId: null, reservedUntil: null }, // released
      },
    )
    expect(await countMemberHolds(db, 'uid', 'me', now)).toBe(1)
  })
  it('reads the held code from the internal document, which wins over a legacy field', async () => {
    const db = fakeDb(
      [{ id: 'a' }, { id: 'b', reservedVoucherId: 'old' }],
      { v1: { status: 'RESERVED', reservedForOrderId: 'a', reservedUntil: later }, old: { status: 'RESERVED', reservedForOrderId: 'b', reservedUntil: later }, v2: { status: 'RESERVED', reservedForOrderId: 'b', reservedUntil: later } },
      { a: { reservedVoucherId: 'v1' }, b: { reservedVoucherId: 'v2' } },
    )
    expect(await countMemberHolds(db, 'uid', 'me', now)).toBe(2)
  })
  it('is zero without pending orders holding a code', async () => {
    expect(await countMemberHolds(fakeDb([{ id: 'x' }], {}), 'uid', 'me', now)).toBe(0)
  })
})
