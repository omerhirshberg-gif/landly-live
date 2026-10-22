import 'server-only'
import { randomBytes } from 'node:crypto'
import { FieldValue, type Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'

// Saved passkeys, one document per credential: passkeys/{credentialId}
// (base64url). Top level rather than under users/{uid}, because sign-in has
// to find a credential by its id before it knows whose it is. Written and
// read by the /api/auth/passkey and /api/account/passkeys routes only
// (firestore.rules denies clients). The public key is a COSE key, so it is
// not a secret, but nothing outside these routes needs it.
const COLLECTION = 'passkeys'

export interface PasskeyRecord {
  uid: string
  /** The WebAuthn user handle this passkey was created under (users/{uid}.webauthnUserId). */
  webauthnUserId: string
  publicKey: Uint8Array<ArrayBuffer>
  counter: number
  transports: string[]
  deviceType: 'singleDevice' | 'multiDevice'
  backedUp: boolean
  aaguid: string
  name: string
  createdAt: Timestamp | null
  lastUsedAt: Timestamp | null
}

/** What Settings shows for a passkey. */
export interface PasskeySummary {
  id: string
  name: string
  createdAt: string | null
  lastUsedAt: string | null
  synced: boolean
}

export const isCredentialId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{16,1366}$/.test(id)

const toIso = (t: Timestamp | null | undefined) => (t ? t.toDate().toISOString() : null)

export function summarize(id: string, record: Pick<PasskeyRecord, 'name' | 'createdAt' | 'lastUsedAt' | 'backedUp'>): PasskeySummary {
  return { id, name: record.name, createdAt: toIso(record.createdAt), lastUsedAt: toIso(record.lastUsedAt), synced: record.backedUp }
}

export async function getPasskey(id: string): Promise<PasskeyRecord | null> {
  const snap = await getAdminDb().collection(COLLECTION).doc(id).get()
  if (!snap.exists) return null
  const data = snap.data()!
  // Firestore hands Bytes back as a Buffer, which is a Uint8Array.
  return { ...(data as PasskeyRecord), publicKey: new Uint8Array(data.publicKey) }
}

export async function listPasskeys(uid: string): Promise<{ id: string; record: PasskeyRecord }[]> {
  const snap = await getAdminDb().collection(COLLECTION).where('uid', '==', uid).get()
  return snap.docs
    .map((d) => ({ id: d.id, record: d.data() as PasskeyRecord }))
    .sort((a, b) => (a.record.createdAt?.toMillis() ?? 0) - (b.record.createdAt?.toMillis() ?? 0))
}

/** Fails with ALREADY_EXISTS (code 6) when the credential is already saved. */
export async function createPasskey(
  id: string,
  record: Omit<PasskeyRecord, 'createdAt' | 'lastUsedAt'>
): Promise<Pick<PasskeyRecord, 'createdAt'>> {
  await getAdminDb().collection(COLLECTION).doc(id).create({
    ...record,
    publicKey: Buffer.from(record.publicKey),
    createdAt: FieldValue.serverTimestamp(),
    lastUsedAt: null,
  })
  const saved = await getAdminDb().collection(COLLECTION).doc(id).get()
  return { createdAt: (saved.get('createdAt') as Timestamp | undefined) ?? null }
}

export async function recordPasskeyUse(id: string, counter: number): Promise<void> {
  await getAdminDb().collection(COLLECTION).doc(id).update({ counter, lastUsedAt: FieldValue.serverTimestamp() })
}

/** Deletes the member's own passkey; false when it doesn't exist or belongs to someone else. */
export async function deletePasskey(uid: string, id: string): Promise<boolean> {
  const db = getAdminDb()
  const ref = db.collection(COLLECTION).doc(id)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists || snap.get('uid') !== uid) return false
    tx.delete(ref)
    return true
  })
}

/**
 * The member's WebAuthn user handle (32 random bytes, base64url), created on
 * first use. Never the uid itself: the handle is stored on the authenticator
 * and shown to it, so it shouldn't identify the account outside Landly.
 * users/{uid}.webauthnUserId is server-only in firestore.rules. Null when the
 * profile document doesn't exist (the sign-in that creates it hasn't run).
 */
export async function ensureWebAuthnUserId(uid: string): Promise<string | null> {
  const db = getAdminDb()
  const ref = db.collection('users').doc(uid)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return null
    const existing = snap.get('webauthnUserId')
    if (typeof existing === 'string' && existing) return existing
    const created = randomBytes(32).toString('base64url')
    tx.update(ref, { webauthnUserId: created })
    return created
  })
}
