import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { Firestore, Timestamp } from 'firebase-admin/firestore'

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8787') {
  throw new Error('Run npm run test:emulator; only the isolated loopback emulator is permitted.')
}
const projectId = 'demo-landly-payments'
const admin = new Firestore({ projectId })
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => admin }))
vi.mock('@/lib/firebase/verifyRequestUser', () => ({
  requireBusinessUid: async () => 'biz-pager',
  RequestAuthError: class extends Error {},
}))
vi.mock('@/lib/auth/uidRateLimit', () => ({ checkUidRateLimit: () => null }))
const { GET } = await import('@/app/api/business/vouchers/route')

// Ten active vouchers for one business, several sharing a takenAt to the
// nanosecond (the cursor's hard case), plus another business's voucher.
const T = (s: number, n = 0) => new Timestamp(1_790_000_000 + s, n)
const takenAts = [T(9), T(8, 5), T(8, 5), T(8, 5), T(7), T(6, 1), T(6, 1), T(5), T(4), T(3)]
const ids = takenAts.map((_, i) => `customer${i}uid_offer${i}`)

beforeAll(async () => {
  await Promise.all(takenAts.map((takenAt, i) => admin.doc(`vouchers/${ids[i]}`).set({
    userId: `customer${i}uid`, offerId: `offer${i}`, businessId: 'biz-pager', status: 'active', takenAt, redeemedAt: null,
    offerTitle: `Offer ${i}`, redemptionCode: '12345678', redeemToken: 'f'.repeat(32), displayOrderNumber: `#${1001 + i}`,
  })))
  await admin.doc('vouchers/other_offer').set({ userId: 'other', businessId: 'biz-other', status: 'active', takenAt: T(10), offerTitle: 'Not yours' })
})
afterAll(async () => {
  await Promise.all([...ids, 'other_offer'].map((id) => admin.doc(`vouchers/${id}`).delete()))
  await admin.terminate()
})

async function page(cursor: string | null, limit: number) {
  const url = `https://landly.test/api/business/vouchers?status=active&limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
  const res = await GET(new Request(url))
  expect(res.status).toBe(200)
  return res.json() as Promise<{ vouchers: Record<string, unknown>[]; nextCursor: string | null }>
}

it.each([1, 2, 3, 4])('pages through every voucher exactly once, newest first, at limit %i', async (limit) => {
  const seen: Record<string, unknown>[] = []
  let cursor: string | null = null
  do {
    const body = await page(cursor, limit)
    seen.push(...body.vouchers)
    cursor = body.nextCursor
  } while (cursor)
  expect(seen.map((v) => v.offerTitle)).toEqual(takenAts.map((_, i) => `Offer ${i}`).sort((a, b) => {
    const ia = Number(a.slice(6)), ib = Number(b.slice(6))
    return takenAts[ib].toMillis() - takenAts[ia].toMillis() || takenAts[ib].nanoseconds - takenAts[ia].nanoseconds || (ids[ib] < ids[ia] ? -1 : 1)
  }))
  expect(new Set(seen.map((v) => v.id)).size).toBe(10)
})

it('sends no voucher id, customer uid, code or token -- not in rows, not in the cursor', async () => {
  const body = await page(null, 3)
  const raw = JSON.stringify(body) + Buffer.from(body.nextCursor!, 'base64url').toString('utf8')
  for (const secret of [...ids, 'customer0uid', '12345678', 'f'.repeat(32), 'Not yours']) expect(raw).not.toContain(secret)
  expect(Object.keys(body.vouchers[0])).toEqual(['id', 'orderNumber', 'offerTitle', 'takenAt', 'redeemedAt'])
  expect(body.vouchers[0]).toMatchObject({ orderNumber: '#1001', offerTitle: 'Offer 0' })
})

it("refuses a cursor minted for another business's list", async () => {
  const forged = Buffer.from(JSON.stringify({ at: null, skip: 1, scope: 'biz-other:vouchers:active' })).toString('base64url')
  const res = await GET(new Request(`https://landly.test/api/business/vouchers?status=active&cursor=${forged}`))
  expect(res.status).toBe(400)
})
