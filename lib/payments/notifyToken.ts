import 'server-only'
import { createHmac } from 'node:crypto'
import { secretsEqual } from '@/lib/auth/secretCompare'

// The signed token on the notify_url handed to Hosted Fields. It binds the notification to the order the SERVER froze:
// a member who edits the client call cannot point Tranzila's Notify at another order or another amount. It is NOT proof
// that Tranzila sent the request (the URL is visible to the member): that is the verifier's job (verifyTranzilaTransaction.ts).
export interface NotifyClaims { orderId: string; terminal: string; amountAgorot: number }

export function signNotifyToken(claims: NotifyClaims, secret: string): string {
  return createHmac('sha256', secret)
    .update(JSON.stringify(['landly-notify-v1', claims.orderId, claims.terminal, claims.amountAgorot]))
    .digest('hex')
}

export function verifyNotifyToken(token: string | null | undefined, claims: NotifyClaims, secret: string | undefined): boolean {
  if (!token || !secret || !/^[0-9a-f]{64}$/.test(token)) return false
  return secretsEqual(token, signNotifyToken(claims, secret))
}

export function buildNotifyUrl(origin: string, claims: NotifyClaims, secret: string): string {
  const url = new URL('/api/payments/tranzila-webhook', origin)
  url.searchParams.set('o', claims.orderId)
  // The frozen amount rides in the signed URL so the gate needs no database read; the settlement still compares Tranzila's record with the order.
  url.searchParams.set('a', String(claims.amountAgorot))
  url.searchParams.set('t', signNotifyToken(claims, secret))
  return url.toString()
}
