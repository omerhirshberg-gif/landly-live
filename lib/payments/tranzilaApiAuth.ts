import 'server-only'
import { createHmac, randomBytes } from 'node:crypto'

// Tranzila API v2 request authentication (docs.tranzila.com/docs/payments-and-billing/authentication):
// access token = HMAC-SHA256 (lowercase hex) of the app key, keyed by secret + request time + nonce.
export function tranzilaApiHeaders(
  appKey: string, secret: string,
  now: number = Math.floor(Date.now() / 1000), nonce: string = randomBytes(40).toString('hex'),
): Record<string, string> {
  const time = String(now)
  return {
    'Content-Type': 'application/json',
    'X-tranzila-api-app-key': appKey,
    'X-tranzila-api-request-time': time,
    'X-tranzila-api-nonce': nonce,
    'X-tranzila-api-access-token': createHmac('sha256', secret + time + nonce).update(appKey).digest('hex'),
  }
}
