import type { User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './config'

export interface UserDocument {
  email: string
  displayName: string
  phone: string
}

/** Writes the users/{uid} doc for a brand-new account (email/password signup). */
export async function createUserDocument(user: User, { phone = '' }: { phone?: string } = {}) {
  await setDoc(doc(db, 'users', user.uid), {
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    phone,
    createdAt: serverTimestamp(),
  })
}

/** Google sign-in can hit an existing or brand-new account — only create the doc if it's missing. */
export async function ensureUserDocument(user: User) {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  await setDoc(ref, {
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    phone: '',
    createdAt: serverTimestamp(),
  })
}

export async function getUserDocument(uid: string): Promise<UserDocument | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    email: data.email ?? '',
    displayName: data.displayName ?? '',
    phone: data.phone ?? '',
  }
}

export async function updateUserDocument(uid: string, data: { displayName: string; phone: string }) {
  await updateDoc(doc(db, 'users', uid), data)
}
