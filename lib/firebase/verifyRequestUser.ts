import 'server-only'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { getAdminAuth, getAdminDb } from './admin'

export class RequestAuthError extends Error {
  constructor(message: string, public readonly status: 401 | 403 | 503) { super(message) }
}

const INVALID_SESSION_CODES = new Set([
  'auth/argument-error', 'auth/invalid-argument', 'auth/invalid-id-token',
  'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found',
])

export async function getDecodedTokenFromRequest(request: Request): Promise<DecodedIdToken | null> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null
  try {
    // Checks the live Auth record for disabled users and revoked sessions.
    return await getAdminAuth().verifyIdToken(token, true)
  } catch (error) {
    if (INVALID_SESSION_CODES.has((error as { code?: string })?.code ?? '')) return null
    throw new RequestAuthError('Authentication service unavailable.', 503)
  }
}

async function requireRole(request: Request, role: 'customer' | 'business'): Promise<DecodedIdToken> {
  const decoded = await getDecodedTokenFromRequest(request)
  if (!decoded) throw new RequestAuthError('Unauthorized', 401)
  let isBusiness: boolean
  try {
    isBusiness = (await getAdminDb().collection('businesses').doc(decoded.uid).get()).exists
  } catch {
    // An unavailable role lookup is never evidence of customer membership.
    throw new RequestAuthError('Authorization service unavailable.', 503)
  }
  if (isBusiness !== (role === 'business')) throw new RequestAuthError('This account cannot access this resource.', 403)
  return decoded
}

// Signup/verification need an authenticated customer, but not verified email yet.
export function requireCustomer(request: Request): Promise<DecodedIdToken> {
  return requireRole(request, 'customer')
}

export async function requireBusinessUid(request: Request): Promise<string> {
  return (await requireRole(request, 'business')).uid
}

export async function requireVerifiedCustomerUid(request: Request): Promise<string> {
  const decoded = await requireCustomer(request)
  if (decoded.email_verified === true) return decoded.uid
  // A false token claim can be stale immediately after email verification.
  let user
  try {
    user = await getAdminAuth().getUser(decoded.uid)
  } catch (error) {
    if ((error as { code?: string })?.code === 'auth/user-not-found') throw new RequestAuthError('Unauthorized', 401)
    throw new RequestAuthError('Authentication service unavailable.', 503)
  }
  if (user.disabled) throw new RequestAuthError('Unauthorized', 401)
  if (!user.emailVerified) throw new RequestAuthError('Verify your email before continuing.', 403)
  return decoded.uid
}
