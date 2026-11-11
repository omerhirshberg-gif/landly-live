import 'server-only'
import { createHash, randomBytes } from 'node:crypto'

// The link carries 256 random bits. Only their SHA-256 is stored (as the
// document id of merchantInvites), so reading the database never yields a
// working link.
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export const generateInviteToken = () => randomBytes(32).toString('base64url')
export const hashInviteToken = (token: string) => createHash('sha256').update(token).digest('hex')
export const isInviteTokenShape = (token: unknown): token is string => typeof token === 'string' && INVITE_TOKEN_PATTERN.test(token)
