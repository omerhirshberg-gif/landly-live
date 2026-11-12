import 'server-only'
import { NextResponse } from 'next/server'
import { isDurablyLimited } from '@/lib/auth/durableRateLimit.server'

// A per-process fixed window first (a cheap refusal that costs nothing), then,
// for the scopes that cost money or send mail (DURABLE_SCOPES), the same window
// in Firestore (lib/auth/durableRateLimit.server.ts) so a cold start or another
// instance can't reset it. Both business routes share a budget.
// "Sign out of all devices" gets a small one: a member needs it once.
// Email/phone changes from the profile share one budget across their routes.
// The passkey Settings routes (add, list, remove) share one too.
const WINDOW_MS = 60 * 1000
const limits = { payment: 10, business: 60, sessions: 5, contact: 10, passkeys: 20, wallet: 10 } as const
const counts = {
  payment: new Map<string, { count: number; resetAt: number }>(),
  business: new Map<string, { count: number; resetAt: number }>(),
  sessions: new Map<string, { count: number; resetAt: number }>(),
  contact: new Map<string, { count: number; resetAt: number }>(),
  passkeys: new Map<string, { count: number; resetAt: number }>(),
  wallet: new Map<string, { count: number; resetAt: number }>(),
}

// Starting a payment, and the OTP and session routes: each can charge, text or mail someone.
const DURABLE_SCOPES: ReadonlySet<keyof typeof limits> = new Set(['payment', 'contact', 'sessions'])

function tooMany(retryAfterSeconds: number) {
  return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } })
}

export async function checkUidRateLimit(scope: keyof typeof limits, uid: string): Promise<NextResponse | null> {
  const now = Date.now()
  const entries = counts[scope]
  // Drop expired UID entries so inactive accounts don't accumulate indefinitely.
  for (const [key, entry] of entries) if (now >= entry.resetAt) entries.delete(key)
  let entry = entries.get(uid)
  if (!entry) {
    entry = { count: 0, resetAt: now + WINDOW_MS }
    entries.set(uid, entry)
  }
  if (entry.count >= limits[scope]) {
    return tooMany(Math.ceil((entry.resetAt - now) / 1000))
  }
  entry.count += 1
  if (DURABLE_SCOPES.has(scope) && await isDurablyLimited({ scope, key: uid, max: limits[scope], windowMs: WINDOW_MS })) return tooMany(Math.ceil(WINDOW_MS / 1000))
  return null
}
