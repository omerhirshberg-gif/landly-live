import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { isPasswordResetRateLimited } from '@/lib/auth/passwordResetRateLimit'
import { syncSessionCutoff } from '@/lib/auth/sessionRevocation'

// Called by /reset-password once confirmPasswordReset succeeds ({ email }, the
// address verifyPasswordResetCode returned). The reset made Firebase revoke
// every session of the account; this copies that cutoff into
// users/{uid}.sessionsValidAfter so Firestore refuses a stolen session at
// once instead of for up to an hour (lib/auth/sessionRevocation.ts). The
// member isn't signed in yet, hence no token. Safe for anyone to call with
// any address: it only mirrors a revocation Auth already made, and never
// moves the cutoff back. Same answer and floor duration whatever happens, so
// it reveals nothing about which addresses have accounts; it shares
// forgot-password's per-IP budget, the other half of the same flow.
const MIN_RESPONSE_MS = 1000

export async function POST(request: Request) {
  if (isPasswordResetRateLimited(request)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }
  const startedAt = performance.now()
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''

  if (email && email.length <= 254) {
    try {
      const { uid } = await getAdminAuth().getUserByEmail(email)
      // Business logins have no customer data in Firestore to guard.
      if (!(await getAdminDb().collection('businesses').doc(uid).get()).exists) await syncSessionCutoff(uid)
    } catch (err) {
      if ((err as { code?: unknown })?.code !== 'auth/user-not-found') console.error('password-reset-complete failed', (err as { code?: unknown })?.code ?? 'unknown')
    }
  }

  const remaining = MIN_RESPONSE_MS - (performance.now() - startedAt)
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
  return NextResponse.json({ ok: true })
}
