import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// Field-level AES-256-GCM for secrets Firestore must not hold in the clear:
// Multipass voucher codes and merchants' bank details. Each key is 32 random
// bytes, base64, in its own environment variable and never in the repo:
//
//   POOL_CODES_KEY            Multipass pool codes
//   BUSINESS_FINANCIALS_KEY   businessFinancials/{businessId}
//
// Rotation: set `<NAME>_ID` to the new key's id (default "1") with the new key in
// `<NAME>`, and keep each retired key in `<NAME>_<oldId>` so old ciphertext still
// opens. Ciphertext is `v1.<keyId>.<iv>.<tag>.<data>` (base64url), bound to
// `aad` (the document it belongs to) so a copied value fails to decrypt anywhere else.
export type CipherKeyName = 'POOL_CODES_KEY' | 'BUSINESS_FINANCIALS_KEY'

export class CipherConfigError extends Error {}

function keyBytes(name: CipherKeyName, keyId: string): Buffer {
  const current = process.env[`${name}_ID`] || '1'
  const raw = keyId === current ? process.env[name] : process.env[`${name}_${keyId}`]
  if (!raw) throw new CipherConfigError(`${name}${keyId === current ? '' : `_${keyId}`} is not configured.`)
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new CipherConfigError(`${name} must be 32 bytes, base64-encoded.`)
  return key
}

export function encryptField(name: CipherKeyName, plaintext: string, aad: string): string {
  const keyId = process.env[`${name}_ID`] || '1'
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyBytes(name, keyId), iv)
  cipher.setAAD(Buffer.from(aad))
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return ['v1', keyId, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.')
}

export function decryptField(name: CipherKeyName, token: string, aad: string): string {
  const [version, keyId, iv, tag, data] = token.split('.')
  if (version !== 'v1' || !keyId || !iv || !tag || data === undefined) throw new Error('Malformed ciphertext.')
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(name, keyId), Buffer.from(iv, 'base64url'))
  decipher.setAAD(Buffer.from(aad))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
}

/** True when the key is present and well-formed, without exposing it. */
export function cipherKeyConfigured(name: CipherKeyName): boolean {
  try {
    keyBytes(name, process.env[`${name}_ID`] || '1')
    return true
  } catch {
    return false
  }
}
