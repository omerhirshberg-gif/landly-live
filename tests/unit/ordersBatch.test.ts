import { beforeEach, describe, expect, it, vi } from 'vitest'

const fs = vi.hoisted(() => ({
  getDocs: vi.fn(), getDoc: vi.fn(), onSnapshot: vi.fn(),
  query: vi.fn((...parts: unknown[]) => ({ parts })),
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  where: vi.fn((...parts: unknown[]) => ({ where: parts })),
  documentId: vi.fn(() => '__name__'),
  doc: vi.fn((_db: unknown, _c: string, id: string) => ({ id })),
  Timestamp: class {},
}))
vi.mock('firebase/firestore', () => fs)
vi.mock('@/lib/firebase/config', () => ({ db: {} }))
vi.mock('@/lib/firebase/sessionCheck', () => ({ recheckSessionIfDenied: () => {} }))

const { getOrdersByIds } = await import('@/lib/firebase/orders')
const order = (id: string) => ({ id, data: () => ({ status: 'paid', amount: 10, originalPrice: 20, userId: 'u1' }) })

beforeEach(() => { fs.getDocs.mockReset(); fs.getDoc.mockReset() })

describe('getOrdersByIds', () => {
  it('reads 30 orders per query, filtered to the member, and returns null for any missing', async () => {
    const ids = Array.from({ length: 40 }, (_, i) => `u1_o${i}`)
    fs.getDocs.mockImplementation(async (q: { parts: [unknown, { where: unknown[] }, { where: [string, string, string[]] }] }) => {
      expect(q.parts[1].where).toEqual(['userId', '==', 'u1'])
      return { docs: q.parts[2].where[2].filter((id) => id !== 'u1_o5').map(order) }
    })
    const result = await getOrdersByIds('u1', ids)
    expect(fs.getDocs).toHaveBeenCalledTimes(2)
    expect(fs.getDoc).not.toHaveBeenCalled()
    expect(result).toHaveLength(40)
    expect(result[5]).toBeNull()
    expect(result[0]).toMatchObject({ status: 'paid', amount: 10 })
  })

  it('falls back to one read per id when the batched query is refused, still failing soft per order', async () => {
    fs.getDocs.mockRejectedValue(new Error('permission-denied'))
    fs.getDoc.mockImplementation(async (ref: { id: string }) => {
      if (ref.id === 'bad') throw new Error('denied')
      return { exists: () => ref.id !== 'gone', data: () => order(ref.id).data() }
    })
    const result = await getOrdersByIds('u1', ['ok', 'gone', 'bad'])
    expect(result.map((o) => o !== null)).toEqual([true, false, false])
  })

  it('does no read for an empty list', async () => {
    expect(await getOrdersByIds('u1', [])).toEqual([])
    expect(fs.getDocs).not.toHaveBeenCalled()
  })
})
