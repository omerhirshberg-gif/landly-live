import 'server-only'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { getAdminAuth } from './admin'

// Shared by user-authenticated API routes (as opposed to the admin-password
// gate in lib/admin/checkAdminPassword.ts). Client callers send
// `Authorization: Bearer ${await user.getIdToken()}`.
export async function getDecodedTokenFromRequest(request: Request): Promise<DecodedIdToken | null> {
  const authHeader = request.headers.get('authorization') ?? ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  if (!idToken) return null

  try {
    return await getAdminAuth().verifyIdToken(idToken)
  } catch {
    return null
  }
}

export async function getUidFromRequest(request: Request): Promise<string | null> {
  const decoded = await getDecodedTokenFromRequest(request)
  return decoded?.uid ?? null
}

// For customer-facing routes. Email+password signups stay unverified until
// they click the link from /api/auth/send-verification, and the login page
// hiding them is only UX -- anyone can mint an ID token for an unverified
// account via Firebase's REST API, so the claim has to be checked here too.
// Google sign-ins always carry email_verified: true. Business routes keep
// using getUidFromRequest: business logins are admin-created and unverified.
export async function getVerifiedUidFromRequest(request: Request): Promise<string | null> {
  const decoded = await getDecodedTokenFromRequest(request)
  if (!decoded) return null
  if (decoded.email_verified === true) return decoded.uid
  // The claim can be up to an hour stale (a session that was open when the
  // user verified, or was grandfathered by scripts/grandfather-email-verification.mjs),
  // so a false claim is re-checked against the live record before refusing.
  try {
    const user = await getAdminAuth().getUser(decoded.uid)
    return user.emailVerified ? decoded.uid : null
  } catch {
    return null
  }
}
