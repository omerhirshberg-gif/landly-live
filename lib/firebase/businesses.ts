import { signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './config'

export interface BusinessDocument {
  businessName: string
  businessId: string // ח.פ — display/reference only, never used for authentication
  category: string
  location: string // free-text city/address for now, not coordinates
  email: string
  // Not written by any code path today (business docs only ever get an
  // `email`, set from the login email at creation) -- but docs are also
  // created/edited manually in the Firebase Console per the note below, so
  // this reads it defensively rather than assuming it's always absent.
  phone: string
  voucherStats: {
    redeemedTotal: number
    redeemedThisMonth: number
    active: number
  }
}

// Business accounts are created manually in the Firebase Console (Auth user +
// this Firestore doc, same uid) — there's no in-app signup, so no writer here.
export async function getBusinessDocument(uid: string): Promise<BusinessDocument | null> {
  const snap = await getDoc(doc(db, 'businesses', uid))
  if (!snap.exists()) return null
  const data = snap.data()
  const voucherStats = data.voucherStats ?? {}
  return {
    businessName: data.businessName ?? '',
    businessId: data.businessId ?? '',
    category: data.category ?? '',
    location: data.location ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    voucherStats: {
      redeemedTotal: Number(voucherStats.redeemedTotal) || 0,
      redeemedThisMonth: Number(voucherStats.redeemedThisMonth) || 0,
      active: Number(voucherStats.active) || 0,
    },
  }
}

// Business logins belong on /business/login only, so the customer auth pages
// (/login, and /signup's Google button, which also signs in existing
// accounts) call this right after sign-in -- before anything else runs,
// verified or not, and before any customer users/{uid} doc is created. A
// business can read its own businesses/{uid} doc, so the check works
// client-side; the session is dropped immediately when it matches.
//
// TODO(security): pre-existing, tracked separately. Business logins are
// admin-created and unverified, so a Google sign-in using a business's login
// email makes Firebase replace that unverified password provider with
// Google. This check still rejects the session, but the business's password
// no longer works on /business/login afterwards.
export async function signOutIfBusinessAccount(uid: string): Promise<boolean> {
  if (!(await getBusinessDocument(uid))) return false
  await signOut(auth)
  return true
}
