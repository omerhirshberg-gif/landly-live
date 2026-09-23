import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { Firestore } from 'firebase-admin/firestore'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectFirestoreEmulator, getFirestore, doc, getDoc, getDocs, collection, query, where, terminate } from 'firebase/firestore'

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8787') {
  throw new Error('Run npm run test:emulator; only the isolated loopback emulator is permitted.')
}
const projectId = 'demo-landly-payments'
const admin = new Firestore({ projectId })
const apps: ReturnType<typeof initializeApp>[] = []
const clients: ReturnType<typeof getFirestore>[] = []
function client(uid?: string, verified = true) {
  const app = initializeApp({ projectId, apiKey: 'emulator-only' }, `rules-${apps.length}`)
  apps.push(app)
  const db = getFirestore(app)
  clients.push(db)
  connectFirestoreEmulator(db, '127.0.0.1', 8787, uid ? { mockUserToken: { sub: uid, email_verified: verified } } : undefined)
  return db
}
const owner = client('rules-owner')
const other = client('rules-other')
const unverified = client('rules-owner', false)
const anonymous = client()
const business = client('rules-business')
beforeAll(async () => {
  await admin.doc('vouchers/rules-owner_offer').set({ userId: 'rules-owner', offerId: 'rules-offer', status: 'active' })
  await admin.doc('businesses/rules-business').set({ businessName: 'Rules business' })
})
afterAll(async () => {
  await admin.doc('vouchers/rules-owner_offer').delete()
  await admin.doc('businesses/rules-business').delete()
  await Promise.all(clients.map((db) => terminate(db)))
  await Promise.all(apps.map((app) => deleteApp(app)))
  await admin.terminate()
})
it('foreign and nonexistent direct reads both return permission-denied', async () => {
  for (const id of ['rules-owner_offer', 'rules-missing']) {
    await expect(getDoc(doc(other, 'vouchers', id))).rejects.toMatchObject({ code: 'permission-denied' })
  }
  expect((await getDoc(doc(owner, 'vouchers', 'rules-owner_offer'))).exists()).toBe(true)
  await expect(getDoc(doc(owner, 'vouchers', 'rules-missing'))).rejects.toMatchObject({ code: 'permission-denied' })
})
it('owner-scoped queries safely return own vouchers or empty results', async () => {
  const ownQuery = (db: ReturnType<typeof getFirestore>, uid: string, offerId: string) => query(collection(db, 'vouchers'), where('userId', '==', uid), where('offerId', '==', offerId))
  expect((await getDocs(ownQuery(owner, 'rules-owner', 'rules-offer'))).size).toBe(1)
  expect((await getDocs(ownQuery(owner, 'rules-owner', 'rules-missing'))).empty).toBe(true)
  expect((await getDocs(ownQuery(other, 'rules-other', 'rules-offer'))).empty).toBe(true)
  await expect(getDocs(ownQuery(other, 'rules-owner', 'rules-offer'))).rejects.toMatchObject({ code: 'permission-denied' })
  await expect(getDocs(collection(other, 'vouchers'))).rejects.toMatchObject({ code: 'permission-denied' })
})
it('still denies unverified, anonymous, and business callers', async () => {
  for (const [db, uid] of [[unverified, 'rules-owner'], [anonymous, 'rules-owner'], [business, 'rules-business']] as const) {
    await expect(getDoc(doc(db, 'vouchers', 'rules-owner_offer'))).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(getDocs(query(collection(db, 'vouchers'), where('userId', '==', uid)))).rejects.toMatchObject({ code: 'permission-denied' })
  }
})
it('client lookup helpers preserve false/null results for absent vouchers', async () => {
  vi.doMock('@/lib/firebase/config', () => ({ db: owner }))
  const { hasUserClaimedOffer, getUserVoucherForOffer } = await import('@/lib/firebase/vouchers')
  expect(await hasUserClaimedOffer('rules-owner', 'rules-missing')).toBe(false)
  expect(await getUserVoucherForOffer('rules-owner', 'rules-missing')).toBeNull()
  expect(await hasUserClaimedOffer('rules-owner', 'rules-offer')).toBe(true)
  expect(await getUserVoucherForOffer('rules-owner', 'rules-offer')).toMatchObject({ userId: 'rules-owner', offerId: 'rules-offer' })
})
