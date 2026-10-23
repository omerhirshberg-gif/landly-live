import { afterAll, beforeAll, expect, it } from 'vitest'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { initializeApp, deleteApp } from 'firebase/app'
import { collection, connectFirestoreEmulator, deleteField, doc, getDoc, getDocs, getFirestore, query, setDoc, terminate, Timestamp as ClientTimestamp, updateDoc, where } from 'firebase/firestore'

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8787') {
  throw new Error('Run npm run test:emulator; only the isolated loopback emulator is permitted.')
}
const projectId = 'demo-landly-payments'
const admin = new Firestore({ projectId })
const apps: ReturnType<typeof initializeApp>[] = []
const clients: ReturnType<typeof getFirestore>[] = []
// auth_time is the session's sign-in time (seconds), carried by every ID
// token the session refreshes; the rules compare it with sessionsValidAfter.
function client(uid: string, authTime: number) {
  const app = initializeApp({ projectId, apiKey: 'emulator-only' }, `session-rules-${apps.length}`)
  apps.push(app)
  const db = getFirestore(app)
  clients.push(db)
  connectFirestoreEmulator(db, '127.0.0.1', 8787, { mockUserToken: { sub: uid, email_verified: true, auth_time: authTime } })
  return db
}

const REVOKED_AT = Math.floor(Date.now() / 1000) - 600
const MEMBER = 'session-member'
const UNSTAMPED = 'session-unstamped'
const before = client(MEMBER, REVOKED_AT - 60)
const sameSecond = client(MEMBER, REVOKED_AT)
const after = client(MEMBER, REVOKED_AT + 60)
const unstamped = client(UNSTAMPED, REVOKED_AT - 60)
const paths = [
  `users/${MEMBER}`, `users/${MEMBER}/pushTokens/device`, `vouchers/${MEMBER}_offer`, `orders/${MEMBER}_offer`,
  `users/${UNSTAMPED}`, `vouchers/${UNSTAMPED}_offer`,
]

beforeAll(async () => {
  await admin.doc(`users/${MEMBER}`).set({ email: 'member@landly.test', firstName: 'Noa', sessionsValidAfter: Timestamp.fromMillis(REVOKED_AT * 1000) })
  await admin.doc(`users/${MEMBER}/pushTokens/device`).set({ token: 't', platform: 'ios', provider: 'expo', lang: 'he' })
  await admin.doc(`vouchers/${MEMBER}_offer`).set({ userId: MEMBER, offerId: 'offer', status: 'active', redemptionCode: '12345678' })
  await admin.doc(`orders/${MEMBER}_offer`).set({ userId: MEMBER, offerId: 'offer', status: 'paid' })
  await admin.doc(`users/${UNSTAMPED}`).set({ email: 'unstamped@landly.test' })
  await admin.doc(`vouchers/${UNSTAMPED}_offer`).set({ userId: UNSTAMPED, offerId: 'offer', status: 'active' })
})
afterAll(async () => {
  await Promise.all(paths.map((p) => admin.doc(p).delete()))
  await Promise.all(clients.map((db) => terminate(db)))
  await Promise.all(apps.map((app) => deleteApp(app)))
  await admin.terminate()
})

it('a session signed in before the revocation reads and writes nothing of the member', async () => {
  for (const path of [`users/${MEMBER}`, `users/${MEMBER}/pushTokens/device`, `vouchers/${MEMBER}_offer`, `orders/${MEMBER}_offer`]) {
    await expect(getDoc(doc(before, path)), path).rejects.toMatchObject({ code: 'permission-denied' })
  }
  await expect(getDocs(query(collection(before, 'vouchers'), where('userId', '==', MEMBER)))).rejects.toMatchObject({ code: 'permission-denied' })
  await expect(updateDoc(doc(before, `users/${MEMBER}`), { firstName: 'Mallory' })).rejects.toMatchObject({ code: 'permission-denied' })
})

it('a session signed in at or after the revocation works as before', async () => {
  for (const db of [sameSecond, after]) {
    for (const path of [`users/${MEMBER}`, `users/${MEMBER}/pushTokens/device`, `vouchers/${MEMBER}_offer`, `orders/${MEMBER}_offer`]) {
      expect((await getDoc(doc(db, path))).exists(), path).toBe(true)
    }
    expect((await getDocs(query(collection(db, 'vouchers'), where('userId', '==', MEMBER)))).size).toBe(1)
  }
  await expect(updateDoc(doc(after, `users/${MEMBER}`), { firstName: 'Noa' })).resolves.toBeUndefined()
})

it('a member whose sessions were never revoked is unaffected', async () => {
  expect((await getDoc(doc(unstamped, `users/${UNSTAMPED}`))).exists()).toBe(true)
  expect((await getDoc(doc(unstamped, `vouchers/${UNSTAMPED}_offer`))).exists()).toBe(true)
})

it('the cutoff is server-only: no session can move, clear or plant it', async () => {
  for (const patch of [{ sessionsValidAfter: ClientTimestamp.fromMillis(0) }, { sessionsValidAfter: deleteField() }]) {
    await expect(updateDoc(doc(after, `users/${MEMBER}`), patch)).rejects.toMatchObject({ code: 'permission-denied' })
  }
  await expect(updateDoc(doc(unstamped, `users/${UNSTAMPED}`), { sessionsValidAfter: ClientTimestamp.fromMillis(0) })).rejects.toMatchObject({ code: 'permission-denied' })
  const fresh = client('session-new', REVOKED_AT)
  await expect(setDoc(doc(fresh, 'users/session-new'), { email: 'n@landly.test', sessionsValidAfter: ClientTimestamp.fromMillis(0) })).rejects.toMatchObject({ code: 'permission-denied' })
})
