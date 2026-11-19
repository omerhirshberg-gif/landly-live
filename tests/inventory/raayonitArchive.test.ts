import { Timestamp } from 'firebase-admin/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { publicOfferData } from '@/lib/offers/availability'
import { isSuperseded, publishFields, restoreFields } from '@/lib/inventory/raayonitCardActions'
import { ARCHIVED_REASON, CARD_TABS, tabOf } from '@/lib/inventory/raayonitCardTabs'
import { diffCatalog, type ExistingCard, type LiveEntry } from '@/lib/inventory/raayonitLiveDiff'
import { FakeFirestore } from '../helpers/fakeFirestore'

let fake: FakeFirestore
const revalidate = vi.fn()
const audit = vi.fn(async () => undefined)
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: () => fake }))
vi.mock('@/lib/admin/adminAuth', () => ({ requireAdminAuth: () => null }))
vi.mock('@/lib/admin/revalidateHome', () => ({ revalidateGuestHome: () => revalidate() }))
vi.mock('@/lib/admin/auditLog', () => ({ writeAudit: (...a: unknown[]) => audit(...(a as [])) }))

const post = async (body: unknown) => {
  const { POST } = await import('@/app/api/admin/raayonit/offers/route')
  return (await POST(new Request('http://localhost/api/admin/raayonit/offers', { method: 'POST', body: JSON.stringify(body) }))).json()
}
const get = async () => {
  const { GET } = await import('@/app/api/admin/raayonit/offers/route')
  return (await GET(new Request('http://localhost/api/admin/raayonit/offers'))).json() as Promise<{ offers: { id: string; tab: string; deletable: boolean; archivedAt: string | null; superseded: boolean; rejected: boolean }[] }>
}
const base = { fulfillmentType: 'raayonit_pool', title: 't', brandName: 'b', poolId: 'p' }
const archived = (key: string) => ({ ...base, published: false, sourceKey: `retired:x`, archivedReason: ARCHIVED_REASON, archivedSourceKey: key, archivedAt: Timestamp.fromDate(new Date('2026-11-01T10:00:00Z')), retiredAt: Timestamp.now(), retiredReason: 'r', raayonitSyncPending: false })

beforeEach(() => {
  fake = new FakeFirestore(); revalidate.mockClear(); audit.mockClear()
  fake.seed('offers', 'live', { ...base, published: true, sourceKey: 'raayonit:1' })
  fake.seed('offers', 'pend', { ...base, published: false, raayonitSyncPending: true, sourceKey: 'raayonit:2' })
  fake.seed('offers', 'arch', archived('raayonit:3'))
  fake.seed('offers', 'arch2', archived('raayonit:4'))
  fake.seed('offers', 'hid', { ...base, published: false, sourceKey: 'raayonit:5' })
  fake.seed('offers', 'rej', { ...base, published: false, sourceKey: 'raayonit:6', reviewRejectedAt: Timestamp.now() })
  fake.seed('offers', 'old', { ...base, published: false, sourceKey: 'retired:old', supersededBy: 'live' })
  fake.seed('offers', 'other', { fulfillmentType: 'direct_merchant', published: false, sourceKey: 'x' })
  fake.seed('vouchers', 'v1', { offerId: 'arch2' })
})

describe('tab classification', () => {
  it('puts every card in exactly one tab', () => {
    expect(tabOf({ published: true })).toBe('active')
    expect(tabOf({ published: false, pending: true })).toBe('pending')
    expect(tabOf({ published: false, archivedReason: ARCHIVED_REASON })).toBe('archive')
    expect(tabOf({ published: false })).toBe('hidden')
    expect(tabOf({ published: false, archivedReason: 'something_else' })).toBe('hidden')
    expect(CARD_TABS).toEqual(['active', 'pending', 'archive', 'hidden'])
  })
  it('the list API sorts every Raayonit card into a tab and counts none twice', async () => {
    const { offers } = await get()
    expect(offers).toHaveLength(7) // the direct-merchant offer is not a Raayonit card
    const tabs = Object.fromEntries(offers.map((o) => [o.id, o.tab]))
    expect(tabs).toEqual({ live: 'active', pend: 'pending', arch: 'archive', arch2: 'archive', hid: 'hidden', rej: 'hidden', old: 'hidden' })
    expect(offers.find((o) => o.id === 'arch')!.archivedAt).toBe('2026-11-01T10:00:00.000Z')
    expect(offers.find((o) => o.id === 'rej')!.rejected).toBe(true)
    expect(offers.find((o) => o.id === 'old')!.superseded).toBe(true)
  })
  it('only an archived card with no order or voucher is deletable', async () => {
    const { offers } = await get()
    expect(Object.fromEntries(offers.map((o) => [o.id, o.deletable]))).toMatchObject({ arch: true, arch2: false, live: false, hid: false })
  })
})

describe('restore', () => {
  it('brings the card back live under its original key, clearing every archive field and setting restoredAt', async () => {
    expect(await post({ action: 'restore', ids: ['arch'] })).toEqual({ changed: 1 })
    expect(fake.doc('offers', 'arch')).toMatchObject({ published: true, sourceKey: 'raayonit:3', raayonitSyncPending: false, restoredBy: 'admin' })
    const d = fake.doc('offers', 'arch')!
    for (const k of ['archivedReason', 'archivedAt', 'archivedSourceKey', 'retiredAt', 'retiredReason']) expect(d).not.toHaveProperty(k)
    expect(d.restoredAt).toBeInstanceOf(Timestamp)
    expect(revalidate).toHaveBeenCalledTimes(1)
    expect(audit).toHaveBeenCalledTimes(1)
  })
  it('refuses a card that is not archived', async () => {
    expect(await post({ action: 'restore', ids: ['live', 'hid', 'pend', 'old', 'nope'] })).toEqual({ changed: 0 })
    expect(fake.writes).toHaveLength(0)
    expect(revalidate).not.toHaveBeenCalled()
  })
  it('refuses an archived card with no key to return to', () => {
    expect(restoreFields({ archivedReason: ARCHIVED_REASON })).toBeNull()
  })
  it('single-card publish on an archived card goes through the same restore', async () => {
    expect(await post({ published: true, ids: ['arch'] })).toEqual({ changed: 1 })
    expect(fake.doc('offers', 'arch')).toMatchObject({ published: true, sourceKey: 'raayonit:3' })
    expect(fake.doc('offers', 'arch')).not.toHaveProperty('archivedReason')
    expect(fake.doc('offers', 'arch')!.restoredAt).toBeInstanceOf(Timestamp)
  })
})

describe('publish and remove from the site', () => {
  it('publishing a hidden or rejected card clears the rejection', async () => {
    await post({ published: true, ids: ['rej', 'hid'] })
    expect(fake.doc('offers', 'rej')).toMatchObject({ published: true })
    expect(fake.doc('offers', 'rej')).not.toHaveProperty('reviewRejectedAt')
  })
  it('never republishes a superseded card', async () => {
    expect(await post({ published: true, ids: ['old'] })).toEqual({ changed: 0 })
    expect(isSuperseded({ sourceKey: 'retired:old' })).toBe(true)
    expect(publishFields({ sourceKey: 'retired:old' })).toBeNull()
  })
  it('"Publish all" skips pending, archived and rejected cards', async () => {
    const r = await post({ published: true, all: true })
    expect(r).toEqual({ changed: 1 }) // only the plain hidden draft
    expect(fake.doc('offers', 'hid')).toMatchObject({ published: true })
    expect(fake.doc('offers', 'pend')).toMatchObject({ published: false, raayonitSyncPending: true })
    expect(fake.doc('offers', 'arch')).toMatchObject({ published: false, archivedReason: ARCHIVED_REASON })
    expect(fake.doc('offers', 'rej')).toMatchObject({ published: false })
  })
  it('removing a live card from the site only unpublishes it', async () => {
    expect(await post({ published: false, ids: ['live'] })).toEqual({ changed: 1 })
    expect(fake.doc('offers', 'live')).toMatchObject({ published: false, sourceKey: 'raayonit:1' })
  })
})

describe('permanent delete', () => {
  it('deletes an archived card nothing points at, behind the id list', async () => {
    expect(await post({ action: 'delete', ids: ['arch'] })).toEqual({ deleted: 1, refused: 0 })
    expect(fake.has('offers', 'arch')).toBe(false)
    expect(audit).toHaveBeenCalledTimes(1)
  })
  it('keeps a card an order or voucher points at, and anything not archived', async () => {
    expect(await post({ action: 'delete', ids: ['arch2', 'live', 'hid', 'pend'] })).toEqual({ deleted: 0, refused: 4 })
    for (const id of ['arch2', 'live', 'hid', 'pend']) expect(fake.has('offers', id)).toBe(true)
    expect(fake.writes.filter((w) => w.op === 'delete')).toHaveLength(0)
  })
})

describe('feeds', () => {
  const ctx = { poolRemaining: new Map([['p', 5]]), activeBusinesses: null }
  it('an archived card is excluded and a restored one is listed', async () => {
    expect(publicOfferData(fake.doc('offers', 'arch')!, ctx)).toBeNull()
    await post({ action: 'restore', ids: ['arch'] })
    expect(publicOfferData(fake.doc('offers', 'arch')!, ctx)).not.toBeNull()
  })
})

describe('the nightly sync respects a manual restore', () => {
  const card = (over: Partial<ExistingCard>): ExistingCard => ({ id: 'c', sourceKey: 'raayonit:l-1', brandName: 'עסק', published: true, pending: false, ...over })
  const none: LiveEntry[] = []
  it('does not archive a restored card Raayonit still does not list', () => {
    expect(diffCatalog(none, [card({ restored: true })]).removed).toHaveLength(0)
    expect(diffCatalog(none, [card({})]).removed).toHaveLength(1)
  })
  it('clears the protection once Raayonit lists it, so a later removal archives it', () => {
    const live: LiveEntry[] = [{ key: 'l-1', nameHe: 'עסק', nameEn: '', source: 'listing' }]
    const d = diffCatalog(live, [card({ restored: true })])
    expect(d.relisted.map((c) => c.id)).toEqual(['c'])
    expect(d.removed).toHaveLength(0)
    expect(diffCatalog(none, [card({})]).removed).toHaveLength(1) // protection cleared: archived next time
  })
})
