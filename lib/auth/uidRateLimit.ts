import 'server-only'
import { NextResponse } from 'next/server'

// Per-process fixed windows, like the existing auth limiters. Resets on cold
// starts and is not shared between instances. Both business routes share a budget.
const WINDOW_MS = 60 * 1000
const limits = { payment: 10, business: 60 } as const
const counts = {
  payment: new Map<string, { count: number; resetAt: number }>(),
  business: new Map<string, { count: number; resetAt: number }>(),
}

export function checkUidRateLimit(scope: keyof typeof limits, uid: string): NextResponse | null {
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
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) },
    })
  }
  entry.count += 1
  return null
}
