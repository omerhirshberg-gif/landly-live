import { after, NextResponse } from 'next/server'
import { clientIp } from '@/lib/auth/clientIp'
import { sendWaitlistWelcomeEmail } from '@/lib/email/sendWaitlistWelcomeEmail'
import { getAdminDb } from '@/lib/firebase/admin'
import { syncLeadToRavMesser } from '@/lib/marketing/ravMesser.server'
import { joinWaitlist, newLeadId } from '@/lib/prelaunch/leads.server'
import { reservePrelaunchAttempt } from '@/lib/prelaunch/throttle.server'
import { parseLeadSubmission } from '@/lib/prelaunch/validation'

// Public: the /join waiting-list form. Bad requests are turned away before any
// Firestore work, so garbage costs nothing; a sign-up then passes the IP window
// and is written in one transaction. New and repeat sign-ups answer the same,
// so this can't be used to learn who is on the list. A new lead goes to the
// Rav Messer list and gets its welcome email after the response, so neither can
// slow or fail the sign-up. /api/cron/prelaunch-sync picks up any sync left
// unfinished; a welcome email that fails is logged and not retried.
const MAX_BODY_BYTES = 4096

// Same-origin only. A request with no Origin is left to the other checks:
// this route has no cookie or session for another site to borrow.
function isCrossOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).host !== request.headers.get('host')
  } catch {
    return true
  }
}

export async function POST(request: Request) {
  if (isCrossOrigin(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const text = await request.text().catch(() => '')
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  // Honeypot: a hidden field real visitors never fill. Bots get a fake success.
  const { website } = (body ?? {}) as { website?: unknown }
  if (typeof website === 'string' && website.trim()) {
    return NextResponse.json({ ok: true, referralCode: newLeadId() })
  }

  const lead = parseLeadSubmission(body)
  if (!lead) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  try {
    const db = getAdminDb()
    if (!(await reservePrelaunchAttempt(db, clientIp(request)))) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }
    const { leadId, created } = await joinWaitlist(db, lead)
    if (created) after(() => Promise.all([syncLeadToRavMesser(db, leadId), sendWaitlistWelcomeEmail(db, leadId)]))
    return NextResponse.json({ ok: true, referralCode: leadId })
  } catch (err) {
    // Never the lead's details in the log.
    console.error('prelaunch join failed', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
