import { afterAll, beforeEach, expect, it } from 'vitest'
import { Firestore } from 'firebase-admin/firestore'
import { deleteApp, initializeApp } from 'firebase/app'
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc, terminate } from 'firebase/firestore'
import { joinWaitlist } from '@/lib/prelaunch/leads.server'
import { parseLeadSubmission } from '@/lib/prelaunch/validation'

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8787') {
  throw new Error('Run npm run test:emulator; only the isolated loopback emulator is permitted.')
}
const projectId = 'demo-landly-payments'
const admin = new Firestore({ projectId })
const app = initializeApp({ projectId, apiKey: 'emulator-only' }, 'prelaunch-rules')
const client = getFirestore(app)
connectFirestoreEmulator(client, '127.0.0.1', 8787, { mockUserToken: { sub: 'some-member', email_verified: true } })

const lead = (i: number, shared: 'phone' | 'email') => parseLeadSubmission({
  firstName: `Lead ${i}`,
  lastName: 'Cohen',
  phone: shared === 'phone' ? '+972501234567' : `+97250123${String(4000 + i)}`,
  email: shared === 'email' ? 'same@example.com' : `lead${i}@example.com`,
  consent: true,
  lang: 'he',
})!

async function wipe() {
  for (const name of ['prelaunch_leads', 'prelaunch_lead_keys']) await admin.recursiveDelete(admin.collection(name))
}
beforeEach(wipe)
afterAll(async () => {
  await wipe()
  await terminate(client)
  await deleteApp(app)
  await admin.terminate()
})

it.each(['phone', 'email'] as const)('parallel sign-ups sharing a %s make one lead', async (shared) => {
  const joined = await Promise.all(Array.from({ length: 8 }, (_, i) => joinWaitlist(admin, lead(i, shared))))
  expect(new Set(joined.map(({ leadId }) => leadId)).size).toBe(1)
  expect(joined.filter(({ created }) => created)).toHaveLength(1)
  expect((await admin.collection('prelaunch_leads').get()).size).toBe(1)
})

it('stores the new answers, and a repeat sign-up never overwrites them', async () => {
  const first = parseLeadSubmission({ firstName: 'Noa', lastName: 'Cohen', phone: '+972501234567', email: 'noa@example.com', consent: true, lang: 'he', preferredLanguage: 'ru', persona: 'other', personaOtherDescription: ' Here for work ', referralSource: 'tiktok' })!
  const { leadId } = await joinWaitlist(admin, first)
  await joinWaitlist(admin, { ...first, preferredLanguage: 'fr', referralSource: 'google' })
  expect((await admin.collection('prelaunch_leads').doc(leadId).get()).data()).toMatchObject({ lang: 'he', preferredLanguage: 'ru', persona: 'other', personaOtherDescription: 'Here for work', referralSource: 'tiktok' })
})

it.each(['prelaunch_leads/a', 'prelaunch_lead_keys/a', 'prelaunch_throttle/a'])('a signed-in client can neither read nor write %s', async (path) => {
  await admin.doc(path).set({ phone: '+972501234567' })
  await expect(getDoc(doc(client, path))).rejects.toThrow()
  await expect(setDoc(doc(client, path), { phone: 'x' })).rejects.toThrow()
  await admin.doc(path).delete()
})
