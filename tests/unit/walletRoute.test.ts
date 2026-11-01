import { Timestamp } from 'firebase-admin/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The route end to end, with Firebase stubbed: no voucher is ever written.
const auth = vi.hoisted(() => ({ uid: 'member1' as string | null, error: null as Error | null }))
const docs = vi.hoisted(() => ({ vouchers: {} as Record<string, Record<string, unknown>> }))

vi.mock('@/lib/firebase/verifyRequestUser', () => {
  class RequestAuthError extends Error {
    constructor(message: string, public readonly status: 401 | 403 | 503) { super(message) }
  }
  return {
    RequestAuthError,
    requireVerifiedCustomerUid: async () => {
      if (!auth.uid) throw new RequestAuthError('Unauthorized', 401)
      return auth.uid
    },
  }
})
vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = name === 'vouchers' ? docs.vouchers[id] : undefined
          return { id, data: () => data, get: (key: string) => data?.[key] }
        },
      }),
    }),
  }),
}))

const { GET, POST } = await import('@/app/api/wallet/apple/[voucherId]/route')
const { GET: availability } = await import('@/app/api/wallet/apple/availability/route')

const ID = 'member1_offer1'
const BASE = `http://localhost:3000/api/wallet/apple/${ID}`
const params = (voucherId = ID) => ({ params: Promise.resolve({ voucherId }) })
const post = (voucherId = ID) => POST(new Request(BASE, { method: 'POST', headers: { Authorization: 'Bearer t' } }), params(voucherId))

beforeEach(() => {
  auth.uid = `member${Math.random()}`.replace('.', '')
  docs.vouchers = {
    [ID]: {
      userId: auth.uid, offerId: 'offer1', businessName: 'Cafe', offerTitle: 'Coffee', redemptionCode: '123456',
      redeemToken: 'b'.repeat(32), status: 'active', expiresAt: Timestamp.fromDate(new Date(Date.now() + 86_400_000)),
    },
  }
})

describe('Apple Wallet routes', () => {
  it('says a mock is available in tests', async () => {
    expect(await (await availability(new Request('http://localhost/x'))).json()).toEqual({ available: true })
  })

  it('issues a ticket, and the ticket gets the pass with the mock header', async () => {
    const res = await post()
    expect(res.status).toBe(200)
    const { url, mock } = await res.json()
    expect(mock).toBe(true)
    const pass = await GET(new Request(url), params())
    expect(pass.status).toBe(200)
    expect(pass.headers.get('content-type')).toBe('application/vnd.apple.pkpass')
    expect(pass.headers.get('x-landly-pass-mock')).toBe('1')
    expect(pass.headers.get('cache-control')).toBe('private, no-store')
    expect(Buffer.from(await pass.arrayBuffer()).subarray(0, 2).toString()).toBe('PK')
  })

  it('refuses a signed-out member', async () => {
    auth.uid = null
    expect((await post()).status).toBe(401)
  })

  it('answers the same for a foreign voucher as for a missing one', async () => {
    docs.vouchers[ID].userId = 'someone-else'
    expect((await post()).status).toBe(404)
    expect((await post('nothing_here')).status).toBe(404)
  })

  it('refuses a voucher that is used, or has no token', async () => {
    docs.vouchers[ID].status = 'redeemed'
    expect((await post()).status).toBe(409)
    docs.vouchers[ID].status = 'active'
    docs.vouchers[ID].redeemToken = null
    expect((await post()).status).toBe(409)
  })

  it('needs a valid ticket, and re-checks the voucher when it is used', async () => {
    expect((await GET(new Request(BASE), params())).status).toBe(401)
    expect((await GET(new Request(`${BASE}?ticket=1.a.b`), params())).status).toBe(401)
    const { url } = await (await post()).json()
    docs.vouchers[ID].status = 'refunded'
    expect((await GET(new Request(url), params())).status).toBe(409)
  })
})
