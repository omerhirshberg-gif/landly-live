import type { User } from 'firebase/auth'
import { arrayRemove, arrayUnion, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './config'

export interface UserDocument {
  email: string
  displayName: string
  phone: string
  customerType: string
  wishlistOfferIds: string[]
  preferredLanguage: string
  /** The member allowed notifications during sign-up (no push tokens are stored yet). */
  notificationsOptIn: boolean
}

/**
 * Creates the users/{uid} doc if it's missing: on every Google sign-in, and on
 * an email+password account's first verified sign-in (normally already created
 * server-side by /api/auth/send-verification; sign-up itself writes nothing).
 */
export async function ensureUserDocument(user: User, { preferredLanguage = 'en' }: { preferredLanguage?: string } = {}) {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  await setDoc(ref, {
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    phone: '',
    customerType: '',
    wishlistOfferIds: [],
    preferredLanguage,
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
    wishlistOfferIds: Array.isArray(data.wishlistOfferIds) ? data.wishlistOfferIds : [],
    preferredLanguage: data.preferredLanguage ?? 'en',
    notificationsOptIn: data.notificationsOptIn === true,
  }
}

export async function updateUserDocument(
  uid: string,
  data: { displayName: string; phone: string; customerType?: string }
) {
  await updateDoc(doc(db, 'users', uid), data)
}

/** The post-sign-in onboarding answers (the member is verified by then, so the doc is writable). */
export async function completeOnboardingProfile(
  uid: string,
  data: { phone: string; customerType: string; preferredLanguage: string; notificationsOptIn: boolean }
) {
  await updateDoc(doc(db, 'users', uid), data)
}

export async function updateUserLanguage(uid: string, preferredLanguage: string) {
  await updateDoc(doc(db, 'users', uid), { preferredLanguage })
}

export async function setOfferWishlisted(uid: string, offerId: string, wishlisted: boolean) {
  await updateDoc(doc(db, 'users', uid), {
    wishlistOfferIds: wishlisted ? arrayUnion(offerId) : arrayRemove(offerId),
  })
}
