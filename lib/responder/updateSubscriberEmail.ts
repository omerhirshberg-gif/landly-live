import 'server-only'
import { createSubscriber, logFailure, readBody, responderError, withResponder, type ResponderOutcome, type ResponderSession } from './client'

// Carries a verified email change (/api/account/verify-email-otp) over to the
// Responder list of a member who opted into marketing. Responder Live has no
// email filter and no update route its graph API was seen answering, so this
// reads the list (GET /lists/{id}/subscribers, paged by limit/offset; each
// record carries email, unsubscribed and blocked) and looks for both
// addresses itself:
// - either address unsubscribed or blocked there: nothing is added -- the
//   member opted out in Responder, which our marketingOptIn never hears about;
// - the new address already in the list: nothing to do;
// - otherwise the new address is added as addSubscriber does.
// The previous address stays in the list (no remove route is known). Never
// throws; failures log like addSubscriber, addresses masked, never the name.
// A list that can't be read fails rather than add an address that may have
// opted out.

export type EmailChangeOutcome = ResponderOutcome | 'optedOut'

const PAGE_SIZE = 200
const MAX_PAGES = 50

interface ListRecord {
  email?: unknown
  unsubscribed?: unknown
  blocked?: unknown
}

const optedOut = (record: ListRecord) => Number(record.unsubscribed) === 1 || Number(record.blocked) === 1
const sameAddress = (record: ListRecord, email: string) => typeof record.email === 'string' && record.email.trim().toLowerCase() === email

// The list's records for the given (lowercased) addresses, or null when the
// list can't be read to the end.
async function findRecords(session: ResponderSession, uid: string, emails: string[]): Promise<Map<string, ListRecord> | null> {
  const found = new Map<string, ListRecord>()
  let offset = 0
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await session.call('GET', `/lists/${session.listId}/subscribers?limit=${PAGE_SIZE}&offset=${offset}`)
    const body = await readBody(res)
    const data = (body as { status?: unknown; data?: unknown } | null)?.data
    if (!res.ok || (body as { status?: unknown } | null)?.status !== true || !Array.isArray(data)) {
      logFailure('lookup', uid, { status: res.status, ...responderError(body) })
      return null
    }
    for (const record of data as ListRecord[]) {
      const email = emails.find((e) => sameAddress(record, e))
      if (email && !found.has(email)) found.set(email, record)
    }
    if (data.length === 0 || found.size === emails.length) return found
    offset += data.length
  }
  logFailure('lookup', uid, { code: 'tooManyPages', pages: MAX_PAGES })
  return null
}

export async function updateSubscriberEmail({
  uid,
  oldEmail,
  newEmail,
  firstName,
}: {
  uid: string
  oldEmail: string
  newEmail: string
  firstName: string
}): Promise<EmailChangeOutcome> {
  const previous = oldEmail.trim().toLowerCase()
  const next = newEmail.trim().toLowerCase()
  if (!previous || !next || previous === next) return 'skipped'

  return withResponder<EmailChangeOutcome>(uid, async (session) => {
    const records = await findRecords(session, uid, [previous, next])
    if (!records) return 'failed'
    const oldRecord = records.get(previous)
    const newRecord = records.get(next)
    if ((oldRecord && optedOut(oldRecord)) || (newRecord && optedOut(newRecord))) return 'optedOut'
    if (newRecord) return 'existing'
    return createSubscriber(session, uid, newEmail.trim(), firstName)
  })
}
