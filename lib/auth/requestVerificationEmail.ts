import type { Lang } from '@/lib/i18n/translations'

export type VerificationSendResult = 'sent' | 'rateLimited' | 'unauthorized' | 'failed'

// Client-side caller for /api/auth/send-verification. Takes a raw ID token
// rather than a User because callers sign the unverified user out right
// away (so the rest of the app never treats them as logged in) and keep
// only the token around for the "resend" button.
export async function requestVerificationEmail(idToken: string, lang: Lang): Promise<VerificationSendResult> {
  try {
    const res = await fetch('/api/auth/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ lang }),
    })
    if (res.ok) return 'sent'
    if (res.status === 429) return 'rateLimited'
    if (res.status === 401) return 'unauthorized'
    return 'failed'
  } catch {
    return 'failed'
  }
}
