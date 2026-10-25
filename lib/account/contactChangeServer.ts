import 'server-only'
import { NextResponse } from 'next/server'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import { corsHeaders } from '@/lib/auth/cors'
import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { requireCustomer, RequestAuthError } from '@/lib/firebase/verifyRequestUser'

// Shared plumbing for the /api/account email and phone change routes (web
// same-origin, the app via API_BASE_URL, the Expo web build via CORS).
// Failures always answer with a coarse `reason` the clients map to copy
// (lib/account/contactChange.ts); details only reach the server log, which
// never gets an address, a number, a token or a code.

export type Reply = (body: Record<string, unknown>, status?: number) => NextResponse

export function replyFor(request: Request): Reply {
  const cors = corsHeaders(request)
  return (body, status = 200) => NextResponse.json(body, { status, headers: cors })
}

export function preflight(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

/** The signed-in customer, or the reply to send instead (unauthorized, unavailable, rate limited). */
export async function customerOrReply(request: Request, reply: Reply): Promise<DecodedIdToken | NextResponse> {
  let decoded: DecodedIdToken
  try {
    decoded = await requireCustomer(request)
  } catch (err) {
    if (err instanceof RequestAuthError) {
      return reply({ error: err.message, reason: err.status === 503 ? 'unavailable' : 'unauthorized' }, err.status)
    }
    return reply({ error: 'Authorization service unavailable.', reason: 'unavailable' }, 503)
  }
  if (checkUidRateLimit('contact', decoded.uid)) return reply({ error: 'Too many requests.', reason: 'rateLimited' }, 429)
  return decoded
}

export function logContactFailure(route: string, step: string, uid: string | null, err: unknown) {
  const e = err as { code?: unknown; message?: unknown } | null
  console.error(`[${route}] step=${step}`, JSON.stringify({ step, uid, code: e?.code, message: typeof e?.message === 'string' ? e.message : String(err) }))
}

/** Field deletes that clear a pending change from users/{uid}. */
export const CLEAR_PENDING_EMAIL = { pendingEmail: FieldValue.delete(), pendingEmailRequestedAt: FieldValue.delete() }
export const CLEAR_PENDING_PHONE = { pendingPhone: FieldValue.delete(), pendingPhoneRequestedAt: FieldValue.delete() }

/**
 * Members whose live `phone` is this E.164 number (at most two, enough to
 * tell whether anyone besides the asking member holds it). The WhatsApp
 * support bot finds a member by `phone`, so a number may belong to one
 * account only.
 */
export const phoneHoldersQuery = (db: Firestore, phone: string) => db.collection('users').where('phone', '==', phone).limit(2)

export const heldByOther = (holders: { docs: { id: string }[] }, uid: string) => holders.docs.some((doc) => doc.id !== uid)
