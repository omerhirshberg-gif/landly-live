import 'server-only'
import { createSubscriber, withResponder, type ResponderOutcome } from './client'

export type { ResponderOutcome } from './client'

// Adds a member who opted into marketing to the Responder Live (Rav-Messer)
// list. Responder Live publishes no API docs; this is the flow its graph API
// answers to: exchange the account's client id/secret and user token for a
// JWT (POST /oauth/token), then create the subscriber with it
// (POST /subscribers, list_ids placing it in the list; lib/responder/client).
// The legacy api.responder.co.il API rejects these credentials ("Invalid
// consumer key"), so it isn't tried.
// Never throws: a missing setting is a silent no-op, anything else one log
// line with the uid, status and Responder's own message -- any address in
// that message is masked, and the member's name is never logged.
export async function addSubscriber({ uid, email, firstName }: { uid: string; email: string; firstName: string }): Promise<ResponderOutcome> {
  if (!email) return 'skipped'
  return withResponder(uid, (session) => createSubscriber(session, uid, email, firstName))
}
