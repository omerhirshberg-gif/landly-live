import type { User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './config'

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
