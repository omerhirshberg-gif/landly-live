import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { MemoryFirestore } from '../helpers/memoryFirestore'

const m = vi.hoisted(() => ({ authError: null as Response | null, store: null as unknown, auth: null as unknown, bucket: null as unknown }))
vi.mock('@/lib/admin/adminAuth', () => ({ requireAdminAuth: () => m.authError }))
vi.mock('@/lib/auth/clientIp', () => ({ clientIp: () => '1.2.3.4' }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: () => (m.store as MemoryFirestore).db,
  getAdminAuth: () => m.auth,
  getAdminBucket: () => m.bucket,
}))

import { DELETE, GET } from '@/app/api/admin/users/[uid]/route'
import { deleteUserPermanently, DELETED_USER, uidAuditHash } from '@/lib/users/deleteUserPermanently.server'
import { loadDeletionPreview } from '@/lib/users/deletionPreview.server'
import { leadKeyId } from '@/lib/prelaunch/leads.server'
import { emailHash } from '@/lib/newsletter/audience.server'
import { parseVoucherStatus } from '@/lib/vouchers/status'
import { readPassVoucher, isPassEligible } from '@/lib/wallet/passVoucher'
import { canOfferWalletPass } from '@/lib/wallet/walletSupport'

const UID = 'member_uid_001'
const EMAIL = 'noa.cohen@example.com'
const PHONE = '+972501234567'
const request = () => new Request('https://golandly.com/api/admin/users/x', { method: 'DELETE' })

function fakeAuth(over: { exists?: boolean; providers?: string[] } = {}) {
  const calls: string[] = []
  const exists = { value: over.exists !== false }
  const auth = {
    calls,
    getUser: async () => {
      if (!exists.value) throw Object.assign(new Error('no user'), { code: 'auth/user-not-found' })
      return { uid: UID, email: EMAIL, phoneNumber: PHONE, providerData: (over.providers ?? ['password']).map((providerId) => ({ providerId })), metadata: {} }
    },
    updateUser: async (_uid: string, patch: unknown) => void calls.push(`update:${JSON.stringify(patch)}`),
    revokeRefreshTokens: async () => void calls.push('revoke'),
    deleteUser: async () => {
      calls.push('delete')
      if (!exists.value) throw Object.assign(new Error('gone'), { code: 'auth/user-not-found' })
      exists.value = false
    },
  }
  return auth
}

function seed(store: MemoryFirestore, { paid = false }: { paid?: boolean } = {}) {
  const now = Timestamp.now()
  store.seed(`users/${UID}`, { email: EMAIL, phone: PHONE, firstName: 'Noa', lastName: 'Cohen' })
  store.seed(`users/${UID}/sessions/s1`, { deviceName: 'iPhone' })
  store.seed(`users/${UID}/pushTokens/t1`, { token: 'abc' })
  store.seed(`vouchers/${UID}_open`, { userId: UID, status: 'active', amountAgorot: paid ? 4500 : 0, offerTitle: 'Coffee', businessName: 'Cafe', displayOrderNumber: 'LND-1001', takenAt: now, redemptionCode: '12345678', redeemToken: 'a'.repeat(32), externalCode: 'EXT-1' })
  store.seed(`vouchers/${UID}_done`, { userId: UID, status: 'redeemed', amountAgorot: 3000, commissionRate: 0.1, payoutBatchId: null, fulfillmentType: 'direct_merchant', businessId: 'biz1', redemptionCode: '87654321', redeemToken: 'b'.repeat(32), takenAt: now, redeemedAt: now })
  store.seed(`orders/${UID}_open`, { userId: UID, status: 'paid', amountAgorot: 4500, tranzilaTxnId: 'TXN-77', voucherId: `${UID}_open`, poolId: 'pool1' })
  store.seed(`orders/${UID}_done`, { userId: UID, status: 'paid', amountAgorot: 3000, tranzilaTxnId: 'TXN-78', voucherId: `${UID}_done`, userEmail: EMAIL })
  store.seed(`supersededOrders/${UID}_x_1`, { userId: UID, status: 'superseded' })
  store.seed('couponPools/pool1/items/i1', { orderId: `${UID}_open`, userId: UID, status: 'allocated' })
  store.seed('passkeys/cred1', { uid: UID })
  store.seed('passkeys/other', { uid: 'someone_else' })
  store.seed(`emailChangeRequests/${UID}`, { newEmail: 'new@example.com' })
  store.seed(`phoneVerifications/${UID}`, { phone: '+972509999999' })
  store.seed(`prelaunch_lead_keys/${leadKeyId('email', EMAIL)}`, { leadId: 'LEAD01' })
  store.seed(`prelaunch_lead_keys/${leadKeyId('phone', PHONE)}`, { leadId: 'LEAD01' })
  store.seed('prelaunch_leads/LEAD01', { email: EMAIL, phone: PHONE, firstName: 'Noa' })
  store.seed(`accountDeletionRequests/${UID}`, { uid: UID, email: EMAIL, name: 'Noa Cohen', details: 'moving abroad', reason: 'other', lang: 'en', status: 'pending', requestedAt: now })
  store.seed('adminAuditLog/old1', { action: 'user.suspend', targetId: UID })
}

let store: MemoryFirestore
let auth: ReturnType<typeof fakeAuth>
let deleted: string[]
const bucket = () => ({ file: (path: string) => ({ delete: async () => void deleted.push(path) }) })
const deps = () => ({ db: store.db, auth: auth as never, bucket: bucket() })

beforeEach(() => {
  store = new MemoryFirestore()
  auth = fakeAuth()
  deleted = []
  m.store = store
  m.auth = auth
  m.bucket = bucket()
  m.authError = null
})

describe('deleteUserPermanently', () => {
  it('cancels unredeemed vouchers and strips their codes, so they can never be redeemed or settled', async () => {
    seed(store)
    const summary = await deleteUserPermanently(deps(), request(), UID, { refundAcknowledged: false })
    const open = store.read(`vouchers/${UID}_open`)!
    expect(open).toMatchObject({ status: 'cancelled', userId: DELETED_USER, cancelReason: 'account_deleted' })
    for (const field of ['redemptionCode', 'redeemToken', 'externalCode']) expect(open).not.toHaveProperty(field)
    expect(summary).toMatchObject({ vouchersCancelled: 1, vouchersAnonymized: 1 })
  })
  it('keeps redeemed vouchers for settlement, anonymised and without codes', async () => {
    seed(store)
    await deleteUserPermanently(deps(), request(), UID, { refundAcknowledged: false })
    const done = store.read(`vouchers/${UID}_done`)!
    expect(done).toMatchObject({ status: 'redeemed', userId: DELETED_USER, amountAgorot: 3000, commissionRate: 0.1, payoutBatchId: null, fulfillmentType: 'direct_merchant', businessId: 'biz1' })
    expect(done).not.toHaveProperty('redemptionCode')
    expect(done).not.toHaveProperty('redeemToken')
  })
  it('keeps paid orders under their own ids, anonymised, and releases the pool item', async () => {
    seed(store)
    const summary = await deleteUserPermanently(deps(), request(), UID, { refundAcknowledged: false })
    expect(store.read(`orders/${UID}_done`)).toMatchObject({ userId: DELETED_USER, status: 'paid', tranzilaTxnId: 'TXN-78', amountAgorot: 3000 })
    expect(store.read(`orders/${UID}_done`)).not.toHaveProperty('userEmail')
    expect(store.read(`supersededOrders/${UID}_x_1`)).toMatchObject({ userId: DELETED_USER })
    expect(store.read('couponPools/pool1/items/i1')).toMatchObject({ userId: DELETED_USER, status: 'allocated' })
    expect(summary).toMatchObject({ ordersAnonymized: 2, poolItemsReleased: 1 })
  })
  it('erases the identity: Auth, profile and subcollections, passkeys, change codes, avatar, lead and its keys', async () => {
    seed(store)
    await deleteUserPermanently(deps(), request(), UID, { refundAcknowledged: false })
    expect(auth.calls).toContain('delete')
    expect(store.read(`users/${UID}`)).toBeUndefined()
    expect(store.read(`users/${UID}/sessions/s1`)).toBeUndefined()
    expect(store.read(`users/${UID}/pushTokens/t1`)).toBeUndefined()
    expect(store.read('passkeys/cred1')).toBeUndefined()
    expect(store.read('passkeys/other')).toBeDefined()
    expect(store.read(`emailChangeRequests/${UID}`)).toBeUndefined()
    expect(store.read(`phoneVerifications/${UID}`)).toBeUndefined()
    expect(store.read('prelaunch_leads/LEAD01')).toBeUndefined()
    expect(store.read(`prelaunch_lead_keys/${leadKeyId('email', EMAIL)}`)).toBeUndefined()
    expect(store.read(`prelaunch_lead_keys/${leadKeyId('phone', PHONE)}`)).toBeUndefined()
    expect(deleted).toEqual([`avatars/${UID}`])
  })
  it('locks sign-in before anything is erased, and Auth goes before the profile', async () => {
    seed(store)
    await deleteUserPermanently(deps(), request(), UID, { refundAcknowledged: false })
    expect(auth.calls.slice(0, 2)).toEqual(['update:{"disabled":true}', 'revoke'])
    expect(auth.calls.at(-1)).toBe('delete')
  })
  it('completes the deletion request and drops what identified the member in it', async () => {
    seed(store)
    await deleteUserPermanently(deps(), request(), UID, { refundAcknowledged: false })
    const record = store.read(`accountDeletionRequests/${UID}`)!
    expect(record).toMatchObject({ status: 'completed', completedBy: 'admin', reason: 'other', lang: 'en' })
    for (const field of ['email', 'name', 'details']) expect(record).not.toHaveProperty(field)
  })
  it('writes a hash-only newsletter suppression for every address the member had', async () => {
    seed(store)
    await deleteUserPermanently(deps(), request(), UID, { refundAcknowledged: false })
    for (const email of [EMAIL, 'new@example.com']) {
      const doc = store.read(`newsletter_suppressions/${emailHash(email)}`)!
      expect(doc.reason).toBe('admin')
      expect(doc).not.toHaveProperty('email')
    }
  })
  it('appends one audit entry with a salted uid hash and counts only, and never rewrites old rows', async () => {
    seed(store)
    await deleteUserPermanently(deps(), request(), UID, { refundAcknowledged: false })
    expect(store.read('adminAuditLog/old1')).toEqual({ action: 'user.suspend', targetId: UID })
    const entries = Object.values(store.list('adminAuditLog')).filter((e) => e.action === 'user.permanentDelete')
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ targetType: 'user', targetId: uidAuditHash(UID), actor: 'admin' })
    expect(uidAuditHash(UID)).toMatch(/^[0-9a-f]{64}$/)
    const text = JSON.stringify(entries[0])
    for (const personal of [UID, EMAIL, PHONE, 'Noa', 'Cohen']) expect(text).not.toContain(personal)
  })
  it('records a Sign in with Apple account in the audit entry and the summary', async () => {
    seed(store)
    auth = fakeAuth({ providers: ['apple.com'] })
    m.auth = auth
    const summary = await deleteUserPermanently(deps(), request(), UID, { refundAcknowledged: false })
    expect(summary.appleLinked).toBe(true)
    const entry = Object.values(store.list('adminAuditLog')).find((e) => e.action === 'user.permanentDelete')!
    expect(entry.note).toMatch(/Apple/)
    expect(entry.after).toMatchObject({ appleLinked: true })
  })

  describe('paid, unredeemed vouchers', () => {
    it('refuses without the refund acknowledgment and changes nothing', async () => {
      seed(store, { paid: true })
      await expect(deleteUserPermanently(deps(), request(), UID, { refundAcknowledged: false })).rejects.toMatchObject({ status: 409 })
      expect(store.read(`vouchers/${UID}_open`)).toMatchObject({ status: 'active', userId: UID })
      expect(store.read(`users/${UID}`)).toBeDefined()
      expect(auth.calls).toEqual([])
    })
    it('goes ahead once acknowledged', async () => {
      seed(store, { paid: true })
      await deleteUserPermanently(deps(), request(), UID, { refundAcknowledged: true })
      expect(store.read(`vouchers/${UID}_open`)).toMatchObject({ status: 'cancelled' })
      expect(store.read(`users/${UID}`)).toBeUndefined()
    })
    it('a free unredeemed voucher needs no acknowledgment', async () => {
      seed(store)
      await expect(deleteUserPermanently(deps(), request(), UID, { refundAcknowledged: false })).resolves.toBeTruthy()
    })
  })

  describe('guards and re-runs', () => {
    it('refuses a business account', async () => {
      seed(store)
      store.seed(`businesses/${UID}`, { name: 'Cafe' })
      await expect(deleteUserPermanently(deps(), request(), UID, { refundAcknowledged: true })).rejects.toThrow(/Businesses/)
      expect(store.read(`users/${UID}`)).toBeDefined()
    })
    it('answers 404 for a member that does not exist, and rejects a malformed uid', async () => {
      auth = fakeAuth({ exists: false })
      await expect(deleteUserPermanently(deps(), request(), 'ghost_member_1', { refundAcknowledged: true })).rejects.toMatchObject({ status: 404 })
      await expect(deleteUserPermanently(deps(), request(), '../x', { refundAcknowledged: true })).rejects.toMatchObject({ status: 400 })
    })
    it('finishes a half-done run: Auth already gone, profile still there', async () => {
      seed(store)
      auth = fakeAuth({ exists: false })
      const summary = await deleteUserPermanently(deps(), request(), UID, { refundAcknowledged: false })
      expect(summary.vouchersCancelled).toBe(1)
      expect(store.read(`users/${UID}`)).toBeUndefined()
    })
    it('tolerates Auth reporting the user already gone at the final delete', async () => {
      seed(store)
      const flaky = fakeAuth()
      flaky.deleteUser = async () => { throw Object.assign(new Error('gone'), { code: 'auth/user-not-found' }) }
      auth = flaky
      await expect(deleteUserPermanently(deps(), request(), UID, { refundAcknowledged: false })).resolves.toBeTruthy()
    })
  })
})

describe('deletion preview', () => {
  it('counts vouchers and lists paid unredeemed ones with order, Tranzila ref, amount and date', async () => {
    seed(store, { paid: true })
    const preview = (await loadDeletionPreview(store.db, auth as never, UID))!
    expect(preview).toMatchObject({ activeVouchers: 1, redeemedVouchers: 1, paidOrders: 2, appleLinked: false, email: EMAIL })
    expect(preview.paidActiveVouchers).toEqual([expect.objectContaining({ voucherId: `${UID}_open`, orderNumber: 'LND-1001', tranzilaTxnId: 'TXN-77', amountAgorot: 4500 })])
  })
  it('has no paid list when nothing paid is open', async () => {
    seed(store)
    expect((await loadDeletionPreview(store.db, auth as never, UID))!.paidActiveVouchers).toEqual([])
  })
})

describe('/api/admin/users/[uid]', () => {
  const ctx = { params: Promise.resolve({ uid: UID }) }
  const del = (body: unknown) => DELETE(new Request('https://golandly.com/api/admin/users/x', { method: 'DELETE', body: JSON.stringify(body) }), ctx)

  it('GET ?preview=1 answers the dialog\'s data and flags a business', async () => {
    seed(store, { paid: true })
    const res = await GET(new Request('https://golandly.com/api/admin/users/x?preview=1'), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ activeVouchers: 1, isBusiness: false, paidActiveVouchers: [expect.objectContaining({ tranzilaTxnId: 'TXN-77' })] })
    store.seed(`businesses/${UID}`, {})
    expect((await (await GET(new Request('https://golandly.com/api/admin/users/x?preview=1'), ctx)).json()).isBusiness).toBe(true)
  })
  it('DELETE needs the typed word', async () => {
    seed(store)
    for (const body of [{}, { confirm: 'delete' }, { confirm: 'DELETE ' }, null]) expect((await del(body)).status).toBe(400)
    expect(store.read(`users/${UID}`)).toBeDefined()
  })
  it('DELETE answers 409 until the refund is acknowledged, then erases', async () => {
    seed(store, { paid: true })
    expect((await del({ confirm: 'DELETE' })).status).toBe(409)
    expect((await del({ confirm: 'DELETE', refundAcknowledged: 'yes' })).status).toBe(409)
    const res = await del({ confirm: 'DELETE', refundAcknowledged: true })
    expect(res.status).toBe(200)
    expect((await res.json()).summary).toMatchObject({ vouchersCancelled: 1 })
    expect(store.read(`users/${UID}`)).toBeUndefined()
  })
  it('DELETE answers 404 for an unknown member and honours the admin guard', async () => {
    auth = fakeAuth({ exists: false }); m.auth = auth
    expect((await del({ confirm: 'DELETE' })).status).toBe(404)
    m.authError = new Response(null, { status: 401 })
    expect((await del({ confirm: 'DELETE' })).status).toBe(401)
    expect((await GET(new Request('https://golandly.com/api/admin/users/x?preview=1'), ctx)).status).toBe(401)
  })
})

describe('cancelled vouchers', () => {
  it('are read as cancelled, never as active', () => {
    expect(parseVoucherStatus('cancelled')).toBe('cancelled')
    expect(parseVoucherStatus('refunded')).toBe('refunded')
    expect(parseVoucherStatus(undefined)).toBe('active')
  })
  it('never go into Apple Wallet and never show a QR', () => {
    const snap = { id: 'v1', data: () => ({ userId: 'u', status: 'cancelled', redeemToken: 'a'.repeat(32), redemptionCode: '12345678', expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000) }) }
    const voucher = readPassVoucher(snap as never)!
    expect(voucher.status).toBe('cancelled')
    expect(isPassEligible(voucher)).toBe(false)
    expect(canOfferWalletPass({ status: 'cancelled', redeemToken: 'a'.repeat(32), expiresAt: null }, Date.now())).toBe(false)
  })
  it('stay out of settlement, which pays only redeemed vouchers', async () => {
    const source = (await import('node:fs')).readFileSync('lib/finance/settlement.ts', 'utf8')
    expect(source).toContain(".where('status', '==', 'redeemed')")
    expect(source).not.toContain('cancelled')
  })
})
void FieldValue
