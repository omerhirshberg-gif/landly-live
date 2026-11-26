import 'server-only'
import { notificationFromForm, readNotificationForm, type TranzilaNotification } from './parseTranzilaNotification'
import { isDocumentId, PaymentError } from './paymentValidation'

// Notify for a Hosted Fields charge (fields.charge({ notify_url })). The exact payload Tranzila posts for Hosted Fields is
// still to be confirmed with Tranzila (docs/payment-and-email-configuration.md, open questions), so this maps the known
// Hosted Fields names onto the canonical iframe-notify names and reuses the same strict validation: one value per field,
// exact response codes, ILS only, standard charge only. A Hosted Fields name is only a fallback when the canonical name is
// absent; the order id comes from the body's orderId or, for Hosted Fields, the signed notify_url's `o` query parameter.
// None of it is trusted for settlement: settleVerifiedPayment.ts re-reads the transaction from Tranzila.
const ALIASES: ReadonlyArray<readonly [canonical: string, alias: string]> = [
  ['supplier', 'terminal_name'],
  ['index', 'transaction_id'],
  ['Response', 'processor_response_code'],
  ['sum', 'amount'],
  ['currency', 'currency_code'],
  ['tranmode', 'tran_mode'],
]

export interface HostedFieldsNotification {
  event: TranzilaNotification
  /** The signed-URL token (`t`), to be checked against the parsed claims. */
  token: string | null
}

export async function parseHostedFieldsNotification(request: Request, terminal: string): Promise<HostedFieldsNotification> {
  const form = await readNotificationForm(request)
  for (const [canonical, alias] of ALIASES) {
    if (!form.has(canonical) && form.has(alias)) form.set(canonical, form.get(alias)!)
  }
  if (form.get('currency') === 'ILS') form.set('currency', '1')
  const query = new URL(request.url).searchParams
  const queryOrder = query.get('o')
  if (!form.has('orderId') && queryOrder) form.set('orderId', queryOrder)
  if (queryOrder && form.get('orderId') !== queryOrder) throw new PaymentError('Conflicting order identifiers.', 400)
  if (!isDocumentId(form.get('orderId'))) throw new PaymentError('Invalid orderId.', 400)
  return { event: notificationFromForm(form, terminal), token: query.get('t') }
}
