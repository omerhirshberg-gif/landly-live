import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import type { Lang } from '@/lib/i18n/translations'
import { fullName } from '@/lib/auth/names'

// gRPC status for a create() on a doc that's already there.
const ALREADY_EXISTS = 6

// Shared by the sign-up verification routes (/api/auth/send-signup-otp and the
// legacy link route /api/auth/send-verification). Never throws: a failure goes
// to `onError` and the first verified sign-in creates the profile instead.
// Sign-up no longer writes the customer profile from the client (that held
// "Creating account…" on a Firestore round trip), so it's created here, off
// the UI's critical path; admin/orphans relies on every customer account
// having one. create() never overwrites an existing doc. A failure is only
// logged: signInCustomerWithEmail also creates it on the first verified sign-in.
// The names come from the sign-up form (only the first request carries them).
export async function ensureCustomerProfile(
  uid: string,
  email: string,
  lang: Lang,
  names: { firstName: string; lastName: string },
  agreedToTerms: boolean,
  marketingOptIn: boolean,
  onError: (err: unknown) => void
) {
  try {
    await getAdminDb().collection('users').doc(uid).create({
      email,
      firstName: names.firstName,
      lastName: names.lastName,
      displayName: fullName(names.firstName, names.lastName),
      phone: '',
      customerType: '',
      wishlistOfferIds: [],
      preferredLanguage: lang,
      notificationsOptIn: false,
      createdAt: FieldValue.serverTimestamp(),
      // The sign-up form's Terms/Privacy checkbox (required there to submit),
      // which also confirms the member is 16 or older.
      ...(agreedToTerms ? { agreedToTerms: true, isAgeConfirmed: true, termsAgreedAt: FieldValue.serverTimestamp() } : {}),
      // The optional marketing checkbox, unticked unless the member ticked it.
      // An opt-in keeps when and where it was given: the Israeli Spam Law
      // (Communications Law §30A) puts proving consent on the sender.
      marketingOptIn,
      ...(marketingOptIn ? { marketingOptInAt: FieldValue.serverTimestamp(), marketingOptInSource: 'signup' } : {}),
    })
  } catch (err) {
    if ((err as { code?: unknown })?.code !== ALREADY_EXISTS) onError(err)
  }
}

// The unverified client can't write its own Auth profile after signing out,
// so the display name is set here too -- only if it's still empty, so a
// later edit from the profile page is never overwritten. That's also where
// ensureUserDocument finds the name if the create above ever failed.
export async function ensureAuthDisplayName(
  uid: string,
  current: string | undefined,
  names: { firstName: string; lastName: string },
  onError: (err: unknown) => void
) {
  const displayName = fullName(names.firstName, names.lastName)
  if (!displayName || current) return
  try {
    await getAdminAuth().updateUser(uid, { displayName })
  } catch (err) {
    onError(err)
  }
}
