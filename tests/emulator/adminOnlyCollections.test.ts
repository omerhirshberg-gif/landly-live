import { afterAll, beforeAll, expect, it } from 'vitest'
import { Firestore } from 'firebase-admin/firestore'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, terminate, updateDoc } from 'firebase/firestore'

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8787') {
  throw new Error('Run npm run test:emulator; only the isolated loopback emulator is permitted.')
}
const projectId = 'demo-landly-payments'
const admin = new Firestore({ projectId })
const app = initializeApp({ projectId, apiKey: 'emulator-only' }, 'admin-only-collections')
const client = getFirestore(app)
connectFirestoreEmulator(client, '127.0.0.1', 8787, { mockUserToken: { sub: 'member-1', email_verified: true } })

// Every path here holds money, secrets or audit records: a signed-in, verified member
// (and so any stolen login) must get nothing from them, by read or write.
const PATHS = [
  'couponPools/pool1', 'couponPools/pool1/items/00000001', 'couponPools/pool1/codeHashes/abc',
  'merchantInvites/hash1', 'merchantInviteBatches/b1', 'businessFinancials/biz1', 'businessContracts/c1',
  'payoutBatches/p1', 'payoutBatches/p1/lines/biz1', 'adminAuditLog/a1', 'rateLimits/r1', 'orderCounter/0',
]

beforeAll(async () => {
  await Promise.all(PATHS.map((p) => admin.doc(p).set({ secret: 'x' })))
  await admin.doc('users/member-1').set({ email: 'm@landly.test', phoneVerified: true })
})
afterAll(async () => {
  await Promise.all([...PATHS, 'users/member-1'].map((p) => admin.doc(p).delete()))
  await terminate(client)
  await deleteApp(app)
  await admin.terminate()
})

it.each(PATHS)('denies reading and writing %s', async (path) => {
  await expect(getDoc(doc(client, path))).rejects.toMatchObject({ code: 'permission-denied' })
  await expect(setDoc(doc(client, path), { secret: 'y' })).rejects.toMatchObject({ code: 'permission-denied' })
  await expect(updateDoc(doc(client, path), { secret: 'y' })).rejects.toMatchObject({ code: 'permission-denied' })
})

it('a member cannot lift their own suspension or edit admin-managed account fields', async () => {
  for (const patch of [{ status: 'active' }, { statusReason: '' }, { kycTier: 'full' }, { passId: 'LND-AAAAAA' }]) {
    await expect(updateDoc(doc(client, 'users/member-1'), patch)).rejects.toMatchObject({ code: 'permission-denied' })
  }
  await expect(updateDoc(doc(client, 'users/member-1'), { israelRegion: 'center' })).resolves.toBeUndefined()
})
