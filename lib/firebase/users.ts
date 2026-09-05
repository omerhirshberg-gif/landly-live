import type { User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './config'

// 'active' is the only status that grants access once SUBSCRIPTION_ENFORCED
// flips on (see lib/subscription.ts) — no real subscription flow writes
// anything but 'inactive' yet, since there's no Tranzila integration.
export type SubscriptionStatus = 'inactive' | 'active'

export interface UserDocument {
  email: string
  displayName: string
  phone: string
  customerType: string
  subscriptionStatus: SubscriptionStatus
}

/** Writes the users/{uid} doc for a brand-new account (email/password signup). */
export async function createUserDocument(
  user: User,
  { phone = '', customerType = '' }: { phone?: string; customerType?: string } = {}
) {
  await setDoc(doc(db, 'users', user.uid), {
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    phone,
    customerType,
    subscriptionStatus: 'inactive',
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
    customerType: '',
    subscriptionStatus: 'inactive',
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
    customerType: data.customerType ?? '',
    subscriptionStatus: data.subscriptionStatus === 'active' ? 'active' : 'inactive',
  }
}

export async function updateUserDocument(uid: string, data: { displayName: string; phone: string }) {
  await updateDoc(doc(db, 'users', uid), data)
}
