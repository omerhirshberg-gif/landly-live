import { afterAll, beforeAll, expect, it } from 'vitest'
import { Firestore } from 'firebase-admin/firestore'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectFirestoreEmulator, deleteField, doc, getDoc, getFirestore, setDoc, terminate, updateDoc } from 'firebase/firestore'

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8787') {
  throw new Error('Run npm run test:emulator; only the isolated loopback emulator is permitted.')
}
const projectId = 'demo-landly-payments'
const admin = new Firestore({ projectId })
const apps: ReturnType<typeof initializeApp>[] = []
const clients: ReturnType<typeof getFirestore>[] = []
function client(uid: string) {
  const app = initializeApp({ projectId, apiKey: 'emulator-only' }, `user-rules-${apps.length}`)
  apps.push(app)
  const db = getFirestore(app)
  clients.push(db)
  connectFirestoreEmulator(db, '127.0.0.1', 8787, { mockUserToken: { sub: uid, email_verified: true } })
  return db
}
const owner = client('contact-owner')
const fresh = client('contact-fresh')
const OWNER = 'users/contact-owner'

beforeAll(async () => {
  await admin.doc(OWNER).set({ email: 'old@landly.test', phone: '+972501234567', pendingEmail: 'new@landly.test', pendingPhone: '+12025550123' })
  await admin.doc('emailChangeRequests/contact-owner').set({ newEmail: 'new@landly.test', tokenHash: 'hash' })
  await admin.doc('phoneVerifications/contact-owner').set({ phone: '+12025550123', codeHash: 'hash', attempts: 0 })
})
afterAll(async () => {
  await Promise.all([OWNER, 'users/contact-fresh', 'emailChangeRequests/contact-owner', 'phoneVerifications/contact-owner'].map((p) => admin.doc(p).delete()))
  await Promise.all(clients.map((db) => terminate(db)))
  await Promise.all(apps.map((app) => deleteApp(app)))
  await admin.terminate()
})

it('the member reads their pending change but can still edit ordinary fields and the phone directly', async () => {
  const snap = await getDoc(doc(owner, OWNER))
  expect(snap.data()).toMatchObject({ pendingEmail: 'new@landly.test', pendingPhone: '+12025550123' })
  await expect(updateDoc(doc(owner, OWNER), { israelRegion: 'center', phone: '+33612345678' })).resolves.toBeUndefined()
})

it('the account email and pending fields are server-only', async () => {
  for (const patch of [
    { email: 'swap@landly.test' },
    { pendingEmail: 'attacker@landly.test' },
    { pendingEmail: deleteField() },
    { pendingPhone: '+447911123456' },
    { pendingPhoneRequestedAt: null },
  ]) {
    await expect(updateDoc(doc(owner, OWNER), patch), JSON.stringify(Object.keys(patch))).rejects.toMatchObject({ code: 'permission-denied' })
  }
})

it('a new profile cannot be created with a pending change', async () => {
  await expect(setDoc(doc(fresh, 'users/contact-fresh'), { email: 'a@landly.test', pendingEmail: 'b@landly.test' })).rejects.toMatchObject({ code: 'permission-denied' })
  await expect(setDoc(doc(fresh, 'users/contact-fresh'), { email: 'a@landly.test', phone: '' })).resolves.toBeUndefined()
})

it('tokens and codes are unreadable and unwritable by their own member', async () => {
  for (const path of ['emailChangeRequests/contact-owner', 'phoneVerifications/contact-owner']) {
    await expect(getDoc(doc(owner, path))).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(setDoc(doc(owner, path), { tokenHash: 'mine' })).rejects.toMatchObject({ code: 'permission-denied' })
  }
})
