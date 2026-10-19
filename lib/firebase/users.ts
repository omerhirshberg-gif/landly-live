import type { User } from 'firebase/auth'
import { arrayRemove, arrayUnion, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, type DocumentData } from 'firebase/firestore'
import { splitDisplayName } from '@/lib/auth/names'
import { personaNote, type CustomerType } from '@/lib/customerTypes'
import { db } from './config'

export interface UserDocument {
  email: string
  firstName: string
  lastName: string
  /** `${firstName} ${lastName}`, trimmed. */
  displayName: string
  /** E.164, or '' when the member skipped the WhatsApp card. */
  phone: string
  customerType: string
  /** Free text for customerType 'other' (optional). */
  customerTypeOther: string
  wishlistOfferIds: string[]
  preferredLanguage: string
  /** The member allowed notifications during sign-up (no push tokens are stored yet). */
  notificationsOptIn: boolean
  /** The onboarding cards were finished (users/{uid}.onboardingCompletedAt is set). */
  onboardingCompleted: boolean
  /** Download URL of the uploaded avatar (avatars/{uid}), or '' for none. */
  photoURL: string
  /** ISO alpha-2 code of the country the member moved from, or '' when not set (members from before the origin card). */
  countryOfOrigin: string
  /** Where in Israel the member lives (lib/profile/countryOfOrigin.ts ISRAEL_REGIONS), or '' when not set. */
  israelRegion: string
  /** A new email waiting for its confirmation link to be opened (server-written), or ''. */
  pendingEmail: string
  /** A new E.164 number waiting for its WhatsApp code (server-written), or ''. */
  pendingPhone: string
}

// A shape check only, so this module stays free of libphonenumber.
const isoCode = (v: unknown) => (typeof v === 'string' && /^[A-Z]{2}$/.test(v) ? v : '')

/**
 * Creates the users/{uid} doc if it's missing: on every Google sign-in, and on
 * an email+password account's first verified sign-in (normally already created
 * server-side by /api/auth/send-verification, names included; sign-up itself
 * writes nothing). Here the names can only come from the Auth display name.
 */
export async function ensureUserDocument(
  user: User,
  { preferredLanguage = 'en', agreedToTerms = false }: { preferredLanguage?: string; agreedToTerms?: boolean } = {}
) {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  const { firstName, lastName } = splitDisplayName(user.displayName)
  await setDoc(ref, {
    email: user.email ?? '',
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`.trim(),
    phone: '',
    customerType: '',
    wishlistOfferIds: [],
    preferredLanguage,
    createdAt: serverTimestamp(),
    // Only when this sign-in path showed the Terms/Privacy disclosure (Google),
    // which also has the member confirm they are 16 or older.
    ...(agreedToTerms ? { agreedToTerms: true, isAgeConfirmed: true, termsAgreedAt: serverTimestamp() } : {}),
  })
}

export async function getUserDocument(uid: string): Promise<UserDocument | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? toUserDocument(snap.data()) : null
}

/**
 * Live users/{uid} for the profile screens (web /profile, the app's Profile
 * tab): a verified email or phone change applied on another device -- or by
 * the server -- clears its amber notice at once. Returns the unsubscribe.
 */
export function subscribeUserDocument(
  uid: string,
  onNext: (profile: UserDocument | null) => void,
  onError: (error: Error) => void
): () => void {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => onNext(snap.exists() ? toUserDocument(snap.data()) : null),
    onError
  )
}

function toUserDocument(data: DocumentData): UserDocument {
  return {
    email: data.email ?? '',
    firstName: typeof data.firstName === 'string' ? data.firstName : '',
    lastName: typeof data.lastName === 'string' ? data.lastName : '',
    displayName: data.displayName ?? '',
    phone: data.phone ?? '',
    customerType: data.customerType ?? '',
    customerTypeOther: typeof data.customerTypeOther === 'string' ? data.customerTypeOther : '',
    wishlistOfferIds: Array.isArray(data.wishlistOfferIds) ? data.wishlistOfferIds : [],
    preferredLanguage: data.preferredLanguage ?? 'en',
    notificationsOptIn: data.notificationsOptIn === true,
    onboardingCompleted: data.onboardingCompletedAt != null,
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : '',
    countryOfOrigin: isoCode(data.countryOfOrigin),
    israelRegion: typeof data.israelRegion === 'string' ? data.israelRegion : '',
    pendingEmail: typeof data.pendingEmail === 'string' ? data.pendingEmail : '',
    pendingPhone: typeof data.pendingPhone === 'string' ? data.pendingPhone : '',
  }
}

export async function updateUserDocument(
  uid: string,
  data: { displayName: string; phone: string; customerType?: string }
) {
  await updateDoc(doc(db, 'users', uid), data)
}

/**
 * The post-sign-in onboarding answers (the member is verified by then, so the
 * doc is writable), stamped as finished. `phone` is '' when the WhatsApp card
 * was skipped.
 */
export async function completeOnboardingProfile(
  uid: string,
  data: {
    phone: string
    customerType: string
    customerTypeOther: string
    countryOfOrigin: string
    preferredLanguage: string
    notificationsOptIn: boolean
  }
) {
  await updateDoc(doc(db, 'users', uid), { ...data, onboardingCompletedAt: serverTimestamp() })
}

/** ISO alpha-2 (lib/profile/countryOfOrigin.ts isCountryCode). */
export async function updateUserCountryOfOrigin(uid: string, countryOfOrigin: string) {
  await updateDoc(doc(db, 'users', uid), { countryOfOrigin })
}

/** One of ISRAEL_REGIONS (lib/profile/countryOfOrigin.ts). */
export async function updateUserRegion(uid: string, israelRegion: string) {
  await updateDoc(doc(db, 'users', uid), { israelRegion })
}

/** E.164 (phoneToE164), or '' to remove the number. */
export async function updateUserPhone(uid: string, phone: string) {
  await updateDoc(doc(db, 'users', uid), { phone })
}

/**
 * The member type from the Member type settings page (web and app). The
 * "Other" note goes through personaNote, so it's kept only for 'other' and
 * cleared for every other type.
 */
export async function updateUserCustomerType(uid: string, customerType: CustomerType, note: string) {
  await updateDoc(doc(db, 'users', uid), { customerType, customerTypeOther: personaNote(customerType, note) })
}

/**
 * The /profile "Edit profile" form (web and app) in one write: phone (E.164,
 * or '' to remove it), member type with its "Other" note (through
 * personaNote), country of origin and region in Israel ('' leaves them unset).
 */
export async function updateUserProfileDetails(
  uid: string,
  data: { phone: string; customerType: CustomerType | ''; customerTypeOther: string; countryOfOrigin: string; israelRegion: string }
) {
  await updateDoc(doc(db, 'users', uid), {
    phone: data.phone,
    customerType: data.customerType,
    customerTypeOther: personaNote(data.customerType, data.customerTypeOther),
    countryOfOrigin: data.countryOfOrigin,
    israelRegion: data.israelRegion,
  })
}

export async function updateUserLanguage(uid: string, preferredLanguage: string) {
  await updateDoc(doc(db, 'users', uid), { preferredLanguage })
}

export async function setOfferWishlisted(uid: string, offerId: string, wishlisted: boolean) {
  await updateDoc(doc(db, 'users', uid), {
    wishlistOfferIds: wishlisted ? arrayUnion(offerId) : arrayRemove(offerId),
  })
}
