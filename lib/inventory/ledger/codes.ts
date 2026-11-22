import 'server-only'
import { createHash } from 'node:crypto'
import { decryptField, encryptField } from '@/lib/crypto/fieldCipher'

// A voucher code is encrypted at rest (AES-256-GCM, POOL_CODES_KEY) with its document id as the AAD, and found by its SHA-256.
// The hash is the same one the legacy couponPools/codeHashes used, so a backfill can dedupe against old stock.

export const hashCode = (code: string): string => createHash('sha256').update(code.trim()).digest('hex')

export const encryptVoucherCode = (code: string, voucherId: string): string => encryptField('POOL_CODES_KEY', code.trim(), `inventoryVouchers/${voucherId}`)
export const decryptVoucherCode = (cipher: string, voucherId: string): string => decryptField('POOL_CODES_KEY', cipher, `inventoryVouchers/${voucherId}`)

/** "••••1234": never more than the last 4 characters, and nothing at all for a short code. */
export function maskCode(code: unknown): string {
  const text = typeof code === 'string' ? code.trim() : ''
  return text.length >= 8 ? `••••${text.slice(-4)}` : '••••'
}

/** The tail an admin can search a row by; never enough to use the code. */
export const codeTail = (code: unknown): string => (typeof code === 'string' && code.trim().length >= 8 ? code.trim().slice(-4) : '')

const CODE_KEYS = /^(code|codes|externalCode|redemptionCode|redeemToken|codeEncrypted|codeCipher|pinCipher|pin|secret|token|authorization)$/i

/**
 * A copy of `value` safe to log or put in an audit entry: every field that holds a code is masked, and any long
 * unbroken digit/letter run inside a string that looks like one is shortened. Cycles and depth are bounded.
 */
export function maskCodesDeep(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[deep]'
  if (typeof value === 'string') return scrubText(value)
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => maskCodesDeep(v, depth + 1))
  if (value && typeof value === 'object' && !(value instanceof Date) && typeof (value as { toMillis?: unknown }).toMillis !== 'function') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, CODE_KEYS.test(k) ? maskCode(typeof v === 'string' ? v : '') : maskCodesDeep(v, depth + 1)]))
  }
  return value
}

/** Free text (an error message) with anything code-shaped (10+ letters/digits/dashes with at least 6 digits) masked. */
export function scrubText(text: string): string {
  return text.replace(/[A-Za-z0-9-]{10,}/g, (run) => ((run.match(/\d/g) ?? []).length >= 6 ? maskCode(run) : run))
}

/** An error's message with codes scrubbed, for console.error. */
export const safeErrorText = (error: unknown): string => scrubText(error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error')
