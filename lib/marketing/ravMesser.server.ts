import 'server-only'
import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import { LEADS_COLLECTION } from '@/lib/prelaunch/leads.server'
import { createSubscriber, responderConfigured, withResponder, type ResponderOptions } from '@/lib/responder/client'

// Puts a /join lead on the pre-launch Rav Messer list and records how it went
// on the lead, for /admin/prelaunch. Runs after the response, from the cron or
// from the admin's Retry, so nothing here ever throws or reaches the form.
//
// `override` and `rejoin` are never sent: someone who opted out in Rav Messer
// stays out if they join again. An address already in the account answers
// duplicate and still joins this list (seen in the live check), so repeating a
// sync is harmless. Rav Messer stores the E.164 phone in its local form.
const DEFAULT_LIST_ID = '127449'

export const ravMesserListId = () => process.env.RAV_MESSER_LIST_ID?.trim() || DEFAULT_LIST_ID

function listOptions(): ResponderOptions {
  return { listId: ravMesserListId(), userToken: process.env.RAV_MESSER_USER_TOKEN?.trim() }
}

export const ravMesserConfigured = () => responderConfigured(listOptions())

interface StoredLead {
  firstName?: string
  /** Absent on leads from before /join asked for it. */
  lastName?: string
  name?: string
  email: string
  phone: string
  lang: string
  persona: string | null
  ravMesserSync?: { synced?: unknown } | null
}

// Personal fields are numeric ids that differ per account. One left unset is
// left out, so a missing setting can never cost the subscriber.
function personalFields(lead: StoredLead): Record<string, string> {
  const fields: Record<string, string> = {}
  const set = (name: string, value: string | null) => {
    const id = process.env[name]?.trim()
    if (id && /^\d+$/.test(id) && value) fields[id] = value
  }
  set('RAV_MESSER_FIELD_PERSONA', lead.persona)
  set('RAV_MESSER_FIELD_LANG', lead.lang)
  return fields
}

export type LeadSyncResult = 'synced' | 'skipped' | 'failed' | 'missing'

export async function syncLeadToRavMesser(db: Firestore, leadId: string): Promise<LeadSyncResult> {
  try {
    const ref = db.collection(LEADS_COLLECTION).doc(leadId)
    const snapshot = await ref.get()
    if (!snapshot.exists) return 'missing'
    const lead = snapshot.data() as StoredLead
    if (lead.ravMesserSync?.synced === true) return 'synced'

    let reason = 'unknown'
    const fields = personalFields(lead)
    const outcome = await withResponder(leadId, (session) => createSubscriber(session, leadId, lead.email, lead.firstName ?? lead.name ?? '', {
      phone: lead.phone,
      ...(lead.lastName ? { last: lead.lastName } : {}),
      ...(Object.keys(fields).length ? { personal_fields: fields } : {}),
    }), { ...listOptions(), onFailure: (code) => { reason = code } })

    // No credentials: not an attempt, so the lead waits, still pending.
    if (outcome === 'skipped') {
      console.warn('[rav-messer] not configured; the lead stays pending')
      return 'skipped'
    }
    const synced = outcome !== 'failed'
    await ref.update({
      ravMesserSync: { synced, syncedAt: synced ? FieldValue.serverTimestamp() : null, error: synced ? null : reason },
      ravMesserSyncAttempts: FieldValue.increment(1),
    })
    return synced ? 'synced' : 'failed'
  } catch (err) {
    // The error alone: a lead's details never reach the log.
    console.error('[rav-messer] sync failed', leadId, err instanceof Error ? err.message : 'unknown error')
    return 'failed'
  }
}

const MAX_ATTEMPTS = 5
const BATCH_SIZE = 25
// A sign-up's own sync gets this long to finish before the sweep touches it.
const SETTLE_MS = 5 * 60_000
// Each sync can take 10 seconds, so a Rav Messer outage must not outrun the
// function: whatever is left waits for the next run.
const SWEEP_BUDGET_MS = 45_000

/** Retries unsynced leads, oldest first. After MAX_ATTEMPTS a lead waits for the admin's Retry. */
export async function sweepUnsyncedLeads(db: Firestore): Promise<{ attempted: number; synced: number }> {
  if (!ravMesserConfigured()) {
    console.warn('[rav-messer] not configured; nothing swept')
    return { attempted: 0, synced: 0 }
  }
  const snapshot = await db.collection(LEADS_COLLECTION)
    .where('ravMesserSync.synced', '==', false)
    .select('createdAt', 'ravMesserSyncAttempts')
    .get()

  const startedAt = Date.now()
  const settled = startedAt - SETTLE_MS
  const due = snapshot.docs
    .map((doc) => ({ id: doc.id, createdAtMs: doc.get('createdAt')?.toMillis?.() ?? 0, attempts: Number(doc.get('ravMesserSyncAttempts') ?? 0) }))
    .filter((lead) => lead.attempts < MAX_ATTEMPTS && lead.createdAtMs <= settled)
    .sort((a, b) => a.createdAtMs - b.createdAtMs)
    .slice(0, BATCH_SIZE)

  let attempted = 0
  let synced = 0
  for (const lead of due) {
    if (Date.now() - startedAt > SWEEP_BUDGET_MS) break
    attempted += 1
    if ((await syncLeadToRavMesser(db, lead.id)) === 'synced') synced += 1
  }
  return { attempted, synced }
}
